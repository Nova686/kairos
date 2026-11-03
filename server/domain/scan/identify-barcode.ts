import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { attachBarcode, findProductByBarcode, type Product } from '../catalogue/catalogue-service.ts'
import {
  searchProductCandidates,
  type ProductCandidate,
  type ProductSearchDependencies,
} from '../catalogue/search-product-candidates.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { normalizeBarcode } from '../../../shared/scan/normalize-barcode.ts'
import type { ProductIdentification } from '../../../src/identification-sources/identification-types.ts'
import { lookupOpenBeautyFacts } from '../../../src/identification-sources/open-beauty-facts.ts'
import { lookupUpcitemdb } from '../../../src/identification-sources/upcitemdb.ts'

export interface BarcodeIdentification {
  barcode: string
  knownProduct: Product | null
  identification: ProductIdentification | null
  candidates: ProductCandidate[]
  unavailableSources: string[]
}

export interface BarcodeLookups {
  lookupOpenBeautyFacts: (barcode: string) => Promise<ProductIdentification | null>
  lookupUpcitemdb: (barcode: string) => Promise<ProductIdentification | null>
  productSearch?: ProductSearchDependencies
}

const defaultLookups: BarcodeLookups = {
  lookupOpenBeautyFacts: barcode => lookupOpenBeautyFacts(barcode),
  lookupUpcitemdb: barcode => lookupUpcitemdb(barcode),
}

const requireNormalizedBarcode = (rawBarcode: string): string => {
  const barcode = normalizeBarcode(rawBarcode)
  if (!barcode) {
    throw createError({ statusCode: 422, statusMessage: 'Code-barres invalide' })
  }
  return barcode
}

const toIdentifiedCandidate = (identification: ProductIdentification): ProductCandidate => ({
  origin: 'identification',
  label: identification.name,
  imageUrl: identification.imageUrl,
  productId: null,
  draft: {
    ...emptyProductDraft(identification.name, identification.source === 'openbeautyfacts' ? 'makeup' : 'other'),
    seriesName: identification.brand,
    imageUrl: identification.imageUrl,
  },
})

export const identifyBarcode = async (
  database: KairosDatabase,
  rawBarcode: string,
  lookups: BarcodeLookups = defaultLookups,
): Promise<BarcodeIdentification> => {
  const barcode = requireNormalizedBarcode(rawBarcode)
  const knownProduct = await findProductByBarcode(database, barcode)
  if (knownProduct) {
    return { barcode, knownProduct, identification: null, candidates: [], unavailableSources: [] }
  }

  const unavailableSources: string[] = []
  const lookupWithoutFailing = async (
    sourceName: string,
    lookup: () => Promise<ProductIdentification | null>,
  ): Promise<ProductIdentification | null> => {
    try {
      return await lookup()
    } catch (failure) {
      if (!(failure instanceof Error)) {
        throw failure
      }
      console.warn(`Barcode lookup failed for ${sourceName} (${barcode}):`, failure)
      unavailableSources.push(sourceName)
      return null
    }
  }

  const upcitemdbBarcode = rawBarcode.trim().length === 12 ? rawBarcode.trim() : barcode
  const identification =
    (await lookupWithoutFailing('openbeautyfacts', () => lookups.lookupOpenBeautyFacts(barcode))) ??
    (await lookupWithoutFailing('upcitemdb', () => lookups.lookupUpcitemdb(upcitemdbBarcode)))
  if (!identification) {
    return { barcode, knownProduct: null, identification: null, candidates: [], unavailableSources }
  }

  const nameSearch = await searchProductCandidates(database, identification.name, lookups.productSearch)
  return {
    barcode,
    knownProduct: null,
    identification,
    candidates: [toIdentifiedCandidate(identification), ...nameSearch.candidates],
    unavailableSources: [...new Set([...unavailableSources, ...nameSearch.unavailableSources])].sort(),
  }
}

export const linkBarcode = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  rawBarcode: string,
): Promise<void> => {
  await attachBarcode(database, userId, productId, requireNormalizedBarcode(rawBarcode))
}
