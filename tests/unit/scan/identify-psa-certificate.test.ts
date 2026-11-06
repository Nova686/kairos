import { purchases, stockItems, users } from '../../../server/database/schema/index.ts'
import { createProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import {
  identifyPsaCertificate,
  type PsaCertificateDependencies,
} from '../../../server/domain/scan/identify-psa-certificate.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { ProductIdentification } from '../../../src/identification-sources/identification-types.ts'
import { SourceBlockedError, SourceDisabledError } from '../../../src/price-sources/price-source-types.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertUser = async (database: KairosDatabase, email: string): Promise<string> => {
  const [user] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return user!.id
}

const insertGradedStockItem = async (
  database: KairosDatabase,
  ownerId: string,
  productId: string,
  overrides: { status: string, gradingCompany?: string, certificateNumber?: string },
): Promise<void> => {
  const [purchase] = await database
    .insert(purchases)
    .values({ ownerId, purchasedOn: '2026-01-01', totalPriceCents: 1000 })
    .returning()
  await database.insert(stockItems).values({
    ownerId,
    productId,
    purchaseId: purchase!.id,
    condition: 'graded',
    gradingCompany: overrides.gradingCompany ?? 'PSA',
    grade: '10',
    certificateNumber: overrides.certificateNumber ?? '12345678',
    allocatedPurchaseCents: 1000,
    status: overrides.status,
  })
}

const certificateIdentification: ProductIdentification = {
  source: 'psa',
  name: '1999 Pokemon Game Charizard #4',
  brand: 'Pokemon Game',
  imageUrl: null,
  barcode: null,
  gradingCompany: 'PSA',
  grade: '10',
  certificateNumber: '12345678',
}

const buildDependencies = (overrides: Partial<PsaCertificateDependencies> = {}): PsaCertificateDependencies => ({
  lookupPsaCertificate: async () => certificateIdentification,
  productSearch: { searchTcgdexCards: async () => [], searchEbayListings: async () => [] },
  ...overrides,
})

const failingWith = (failure: unknown): PsaCertificateDependencies =>
  buildDependencies({
    lookupPsaCertificate: async () => {
      throw failure
    },
  })

describe('identifyPsaCertificate', () => {
  it('prefills the grade from a valid certificate and proposes a graded-card draft', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    const outcome = await identifyPsaCertificate(database, userId, '12345678', buildDependencies())

    expect(outcome.prefilledStockItem).toEqual({
      condition: 'graded',
      gradingCompany: 'PSA',
      grade: '10',
      certificateNumber: '12345678',
    })
    expect(outcome.identification?.name).toBe('1999 Pokemon Game Charizard #4')
    expect(outcome.candidates[0]).toMatchObject({
      origin: 'identification',
      productId: null,
      draft: { name: '1999 Pokemon Game Charizard #4', category: 'graded-card' },
    })
    expect(outcome.unavailableSources).toEqual([])
  })

  it('puts a catalogue product with the same name and category first, ignoring accents and case', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const sameNameOtherCategory = await createProduct(
      database,
      userId,
      emptyProductDraft('1999 pokémon game charizard #4', 'other'),
    )
    const gradedProduct = await createProduct(
      database,
      userId,
      emptyProductDraft('1999 POKÉMON Game Charizard #4', 'graded-card'),
    )

    const outcome = await identifyPsaCertificate(database, userId, '12345678', buildDependencies())

    expect(outcome.candidates[0]).toMatchObject({ origin: 'catalogue', productId: gradedProduct.id })
    expect(outcome.candidates.filter(candidate => candidate.productId === gradedProduct.id)).toHaveLength(1)
    expect(outcome.candidates[0]?.productId).not.toBe(sameNameOtherCategory.id)
    expect(outcome.candidates.some(candidate => candidate.origin === 'identification')).toBe(false)
  })

  it('puts the same-name catalogue product first even when the name search returns nothing', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const gradedProduct = await createProduct(
      database,
      userId,
      emptyProductDraft('1999 Pokemon Game Charizard #4', 'graded-card'),
    )

    const outcome = await identifyPsaCertificate(
      database,
      userId,
      '12345678',
      buildDependencies({
        searchCandidates: async () => ({ candidates: [], unavailableSources: [] }),
      }),
    )

    expect(outcome.candidates[0]).toMatchObject({
      origin: 'catalogue',
      productId: gradedProduct.id,
      label: gradedProduct.name,
      draft: { name: gradedProduct.name, category: 'graded-card' },
    })
    expect(outcome.candidates.filter(candidate => candidate.productId === gradedProduct.id)).toHaveLength(1)
  })

  it.each(['12ab', '123456', '12345678901', ' '])('refuses the certificate %j with 422', async (certificate) => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    await expect(
      identifyPsaCertificate(database, userId, certificate, failingWith(new Error('must not be called'))),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('reports psa as unavailable when the token is missing and still answers', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const outcome = await identifyPsaCertificate(
      database,
      userId,
      '12345678',
      failingWith(new SourceDisabledError('psa', 'PSA_API_TOKEN')),
    )
    expect(warning).toHaveBeenCalledTimes(1)
    warning.mockRestore()

    expect(outcome).toMatchObject({
      identification: null,
      candidates: [],
      prefilledStockItem: null,
      unavailableSources: ['psa'],
    })
  })

  it('reports psa as unavailable on a blocked source or any Error, and rethrows non-Errors', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocked = await identifyPsaCertificate(
      database,
      userId,
      '12345678',
      failingWith(new SourceBlockedError('psa', 'HTTP 429')),
    )
    const generic = await identifyPsaCertificate(database, userId, '12345678', failingWith(new Error('boom')))

    expect(blocked.unavailableSources).toEqual(['psa'])
    expect(generic.unavailableSources).toEqual(['psa'])
    expect(warning).toHaveBeenCalledTimes(2)
    warning.mockRestore()
    await expect(
      identifyPsaCertificate(database, userId, '12345678', failingWith('plain string')),
    ).rejects.toBe('plain string')
  })

  it('answers with no identification when PSA does not know the certificate', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    const outcome = await identifyPsaCertificate(
      database,
      userId,
      '12345678',
      buildDependencies({ lookupPsaCertificate: async () => null }),
    )

    expect(outcome).toMatchObject({
      identification: null,
      candidates: [],
      prefilledStockItem: null,
      unavailableSources: [],
    })
  })

  it('refuses with 409 a certificate already in the stock of the user, whatever the status except sold', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Charizard', 'graded-card'))
    await insertGradedStockItem(database, userId, product.id, { status: 'in-stock' })

    await expect(identifyPsaCertificate(database, userId, '12345678', buildDependencies())).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Ce certificat est déjà dans votre stock',
    })
  })

  it('allows a certificate that was sold, or owned by another user, or graded by another company', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const otherUserId = await insertUser(database, 'b@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Charizard', 'graded-card'))
    await insertGradedStockItem(database, userId, product.id, { status: 'sold' })
    await insertGradedStockItem(database, otherUserId, product.id, { status: 'in-stock' })
    await insertGradedStockItem(database, userId, product.id, { status: 'in-stock', gradingCompany: 'CGC' })

    const outcome = await identifyPsaCertificate(database, userId, '12345678', buildDependencies())

    expect(outcome.prefilledStockItem?.certificateNumber).toBe('12345678')
  })
})
