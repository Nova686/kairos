import { productBarcodes, users } from '../../../server/database/schema/index.ts'
import { createProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import { identifyBarcode, linkBarcode, type BarcodeLookups } from '../../../server/domain/scan/identify-barcode.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { normalizeBarcode } from '../../../shared/scan/normalize-barcode.ts'
import type { ProductIdentification } from '../../../src/identification-sources/identification-types.ts'
import { SourceBlockedError } from '../../../src/price-sources/price-source-types.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertUser = async (database: KairosDatabase): Promise<string> => {
  const [user] = await database
    .insert(users)
    .values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' })
    .returning()
  return user!.id
}

const identification = (source: 'openbeautyfacts' | 'upcitemdb'): ProductIdentification => ({
  source,
  name: 'Rouge Pur Couture',
  brand: 'YSL',
  imageUrl: 'https://img.example/rouge.jpg',
  barcode: '3614272049529',
  gradingCompany: null,
  grade: null,
  certificateNumber: null,
})

const buildLookups = (
  overrides: Partial<BarcodeLookups> = {},
): BarcodeLookups & { openBeautyFactsCalls: string[], upcitemdbCalls: string[] } => {
  const openBeautyFactsCalls: string[] = []
  const upcitemdbCalls: string[] = []
  return {
    openBeautyFactsCalls,
    upcitemdbCalls,
    lookupOpenBeautyFacts: async (barcode) => {
      openBeautyFactsCalls.push(barcode)
      return null
    },
    lookupUpcitemdb: async (barcode) => {
      upcitemdbCalls.push(barcode)
      return null
    },
    productSearch: { searchTcgdexCards: async () => [], searchEbayListings: async () => [] },
    ...overrides,
  }
}

describe('normalizeBarcode', () => {
  it('accepts a valid EAN-13 and refuses a wrong check digit', () => {
    expect(normalizeBarcode('0820650853715')).toBe('0820650853715')
    expect(normalizeBarcode('0820650853716')).toBeNull()
  })

  it('stores a valid UPC-A as its EAN-13 form', () => {
    expect(normalizeBarcode('820650853715')).toBe('0820650853715')
  })

  it('accepts EAN-8 and EAN-14 and refuses other lengths and non-digits', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
    expect(normalizeBarcode('10820650853712')).toBe('10820650853712')
    expect(normalizeBarcode('123456')).toBeNull()
    expect(normalizeBarcode('08206508537a5')).toBeNull()
  })
})

describe('identifyBarcode', () => {
  it('returns the known product without calling any lookup', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await createProduct(database, userId, emptyProductDraft('Display', 'pokemon-sealed'))
    await linkBarcode(database, userId, product.id, '0820650853715')
    const lookups = buildLookups()

    const outcome = await identifyBarcode(database, '820650853715', lookups)

    expect(outcome.knownProduct?.id).toBe(product.id)
    expect(outcome.barcode).toBe('0820650853715')
    expect(lookups.openBeautyFactsCalls).toEqual([])
    expect(lookups.upcitemdbCalls).toEqual([])
  })

  it('stops at Open Beauty Facts and proposes a makeup draft', async () => {
    const database = await createTestDatabase()
    const lookups = buildLookups({ lookupOpenBeautyFacts: async () => identification('openbeautyfacts') })

    const outcome = await identifyBarcode(database, '3614272049529', lookups)

    expect(lookups.upcitemdbCalls).toEqual([])
    expect(outcome.identification?.source).toBe('openbeautyfacts')
    expect(outcome.candidates.at(-1)).toMatchObject({
      origin: 'identification',
      productId: null,
      draft: { name: 'Rouge Pur Couture', category: 'makeup', seriesName: 'YSL', imageUrl: 'https://img.example/rouge.jpg' },
    })
  })

  it('falls back to UPCitemdb with the original 12 digits and uses the other category', async () => {
    const database = await createTestDatabase()
    const lookups = buildLookups()
    lookups.lookupUpcitemdb = async (barcode) => {
      lookups.upcitemdbCalls.push(barcode)
      return identification('upcitemdb')
    }

    const outcome = await identifyBarcode(database, '820650853715', lookups)

    expect(lookups.openBeautyFactsCalls).toEqual(['0820650853715'])
    expect(lookups.upcitemdbCalls).toEqual(['820650853715'])
    expect(outcome.candidates.at(-1)?.draft.category).toBe('other')
  })

  it('asks UPCitemdb for the normalised 13 digits of an EAN-13', async () => {
    const database = await createTestDatabase()
    const lookups = buildLookups()

    await identifyBarcode(database, ' 3614272049529 ', lookups)

    expect(lookups.openBeautyFactsCalls).toEqual(['3614272049529'])
    expect(lookups.upcitemdbCalls).toEqual(['3614272049529'])
  })

  it('reports nothing when both lookups miss', async () => {
    const database = await createTestDatabase()

    const outcome = await identifyBarcode(database, '3614272049529', buildLookups())

    expect(outcome).toMatchObject({ identification: null, candidates: [], knownProduct: null, unavailableSources: [] })
  })

  it('lists a rate-limited source as unavailable instead of failing', async () => {
    const database = await createTestDatabase()
    const lookups = buildLookups({
      lookupUpcitemdb: async () => {
        throw new SourceBlockedError('upcitemdb', 'HTTP 429')
      },
    })

    const outcome = await identifyBarcode(database, '3614272049529', lookups)

    expect(outcome.unavailableSources).toEqual(['upcitemdb'])
  })

  it('lists any other lookup failure as unavailable', async () => {
    const database = await createTestDatabase()
    const lookups = buildLookups({
      lookupOpenBeautyFacts: async () => {
        throw new Error('network down')
      },
    })

    const outcome = await identifyBarcode(database, '3614272049529', lookups)

    expect(outcome.unavailableSources).toEqual(['openbeautyfacts'])
  })

  it('refuses an invalid barcode with 422', async () => {
    const database = await createTestDatabase()

    await expect(identifyBarcode(database, '0820650853716', buildLookups())).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('identifyBarcode failure handling', () => {
  it('logs a TypeError from a lookup and keeps the source unavailable', async () => {
    const database = await createTestDatabase()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lookups = buildLookups({
      lookupOpenBeautyFacts: async () => {
        throw new TypeError('boom')
      },
    })

    const outcome = await identifyBarcode(database, '3614272049529', lookups)

    expect(outcome.unavailableSources).toEqual(['openbeautyfacts'])
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('openbeautyfacts'), expect.any(TypeError))
    warning.mockRestore()
  })

  it('rethrows a non-Error throwable', async () => {
    const database = await createTestDatabase()
    const lookups = buildLookups({
      lookupOpenBeautyFacts: async () => {
        throw 'plain string'
      },
    })

    await expect(identifyBarcode(database, '3614272049529', lookups)).rejects.toBe('plain string')
  })

  it('puts the identification-based candidate before the name-search candidates', async () => {
    const database = await createTestDatabase()
    const [user] = await database.insert(users).values({ email: 'b@example.com', displayName: 'B', passwordHash: 'x' }).returning()
    await createProduct(database, user!.id, emptyProductDraft('Rouge Pur Couture', 'makeup'))
    const lookups = buildLookups({ lookupOpenBeautyFacts: async () => identification('openbeautyfacts') })

    const outcome = await identifyBarcode(database, '3614272049529', lookups)

    expect(outcome.candidates.map(candidate => candidate.origin)).toEqual(['identification', 'catalogue'])
  })
})

describe('linkBarcode', () => {
  it('is idempotent for the same product and 409 for another one', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const firstProduct = await createProduct(database, userId, emptyProductDraft('Un', 'other'))
    const secondProduct = await createProduct(database, userId, emptyProductDraft('Deux', 'other'))

    await linkBarcode(database, userId, firstProduct.id, '820650853715')
    await linkBarcode(database, userId, firstProduct.id, '0820650853715')
    const barcodeRows = await database.select().from(productBarcodes)

    expect(barcodeRows).toHaveLength(1)
    expect(barcodeRows[0]!.barcode).toBe('0820650853715')
    await expect(linkBarcode(database, userId, secondProduct.id, '0820650853715')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('refuses an invalid barcode with 422', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await createProduct(database, userId, emptyProductDraft('Un', 'other'))

    await expect(linkBarcode(database, userId, product.id, '123')).rejects.toMatchObject({ statusCode: 422 })
  })
})
