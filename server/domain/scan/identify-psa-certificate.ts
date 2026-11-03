import { and, eq, ne } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { products, stockItems } from '../../database/schema/index.ts'
import type { Product } from '../catalogue/catalogue-service.ts'
import {
  searchProductCandidates,
  toCatalogueCandidate,
  type ProductCandidate,
  type ProductSearchDependencies,
} from '../catalogue/search-product-candidates.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { canonicalCompanyName } from '../../../shared/prices/grading-company.ts'
import type { ProductIdentification } from '../../../src/identification-sources/identification-types.ts'
import { lookupPsaCertificate } from '../../../src/identification-sources/psa-certificate.ts'

export interface PrefilledGradedStockItem {
  condition: 'graded'
  gradingCompany: string
  grade: string
  certificateNumber: string
}

export interface PsaCertificateIdentification {
  identification: ProductIdentification | null
  candidates: ProductCandidate[]
  prefilledStockItem: PrefilledGradedStockItem | null
  unavailableSources: string[]
}

export interface PsaCertificateDependencies {
  lookupPsaCertificate: (certificateNumber: string) => Promise<ProductIdentification | null>
  productSearch?: ProductSearchDependencies
  searchCandidates?: typeof searchProductCandidates
}

const defaultDependencies: PsaCertificateDependencies = {
  lookupPsaCertificate: certificateNumber => lookupPsaCertificate(certificateNumber),
}

const psaCompanyName = canonicalCompanyName('PSA')

const toComparableName = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const requireCertificateNumber = (rawCertificateNumber: string): string => {
  const certificateNumber = rawCertificateNumber.trim()
  if (!/^\d{7,10}$/.test(certificateNumber)) {
    throw createError({ statusCode: 422, statusMessage: 'Numéro de certificat invalide' })
  }
  return certificateNumber
}

const refuseCertificateAlreadyOwned = async (
  database: KairosDatabase,
  userId: string,
  certificateNumber: string,
): Promise<void> => {
  const ownedStockItems = await database
    .select({ gradingCompany: stockItems.gradingCompany })
    .from(stockItems)
    .where(
      and(
        eq(stockItems.ownerId, userId),
        eq(stockItems.certificateNumber, certificateNumber),
        ne(stockItems.status, 'sold'),
      ),
    )
  const isAlreadyOwned = ownedStockItems.some(
    ownedStockItem => ownedStockItem.gradingCompany !== null
      && canonicalCompanyName(ownedStockItem.gradingCompany) === psaCompanyName,
  )
  if (isAlreadyOwned) {
    throw createError({ statusCode: 409, statusMessage: 'Ce certificat est déjà dans votre stock' })
  }
}

const toGradedCardCandidate = (identification: ProductIdentification): ProductCandidate => ({
  origin: 'identification',
  label: identification.name,
  imageUrl: identification.imageUrl,
  productId: null,
  draft: {
    ...emptyProductDraft(identification.name, 'graded-card'),
    seriesName: identification.brand,
    imageUrl: identification.imageUrl,
  },
})

const findSameGradedCardInCatalogue = async (
  database: KairosDatabase,
  name: string,
): Promise<Product | null> => {
  const gradedCardProducts = await database.select().from(products).where(eq(products.category, 'graded-card'))
  const comparableName = toComparableName(name)
  return gradedCardProducts.find(product => toComparableName(product.name) === comparableName) ?? null
}

export const identifyPsaCertificate = async (
  database: KairosDatabase,
  userId: string,
  rawCertificateNumber: string,
  dependencies: PsaCertificateDependencies = defaultDependencies,
): Promise<PsaCertificateIdentification> => {
  const certificateNumber = requireCertificateNumber(rawCertificateNumber)
  await refuseCertificateAlreadyOwned(database, userId, certificateNumber)

  let identification: ProductIdentification | null
  try {
    identification = await dependencies.lookupPsaCertificate(certificateNumber)
  } catch (failure) {
    if (!(failure instanceof Error)) {
      throw failure
    }
    console.warn(`PSA certificate lookup failed (${certificateNumber}):`, failure)
    return { identification: null, candidates: [], prefilledStockItem: null, unavailableSources: ['psa'] }
  }
  if (!identification) {
    return { identification: null, candidates: [], prefilledStockItem: null, unavailableSources: [] }
  }

  const sameCatalogueProduct = await findSameGradedCardInCatalogue(database, identification.name)
  const nameSearch = await (dependencies.searchCandidates ?? searchProductCandidates)(database, identification.name, dependencies.productSearch)
  const candidates = [
    ...(sameCatalogueProduct ? [toCatalogueCandidate(sameCatalogueProduct)] : []),
    toGradedCardCandidate(identification),
    ...nameSearch.candidates.filter(
      candidate => sameCatalogueProduct === null || candidate.productId !== sameCatalogueProduct.id,
    ),
  ]

  return {
    identification,
    candidates,
    prefilledStockItem: identification.grade
      ? {
          condition: 'graded',
          gradingCompany: psaCompanyName,
          grade: identification.grade,
          certificateNumber,
        }
      : null,
    unavailableSources: nameSearch.unavailableSources,
  }
}
