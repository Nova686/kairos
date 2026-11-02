import { cardmarketProducts, users } from '../../../server/database/schema/index.ts'
import { createProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import {
  searchProductCandidates,
  type ProductSearchDependencies,
} from '../../../server/domain/catalogue/search-product-candidates.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { SourceBlockedError, SourceDisabledError } from '../../../src/price-sources/price-source-types.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertUser = async (database: KairosDatabase): Promise<string> => {
  const [user] = await database
    .insert(users)
    .values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' })
    .returning()
  return user!.id
}

const insertCardmarketProduct = async (database: KairosDatabase, idProduct: number, name: string): Promise<void> => {
  await database.insert(cardmarketProducts).values({ idProduct, name, categoryName: 'Display', idExpansion: 1 })
}

const noSources: ProductSearchDependencies = {
  searchTcgdexCards: async () => [],
  searchEbayListings: async () => [],
}

describe('searchProductCandidates', () => {
  it('returns catalogue products containing every word, accent-insensitively', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    await createProduct(database, userId, emptyProductDraft('Display Écarlate et Violet', 'pokemon-sealed'))
    await createProduct(database, userId, emptyProductDraft('Display Épée et Bouclier', 'pokemon-sealed'))

    const { candidates, unavailableSources } = await searchProductCandidates(database, 'ecarlate display', noSources)

    expect(candidates.map(candidate => candidate.label)).toEqual(['Display Écarlate et Violet'])
    expect(candidates[0]).toMatchObject({ origin: 'catalogue' })
    expect(candidates[0]!.productId).not.toBeNull()
    expect(unavailableSources).toEqual([])
  })

  it('caps each source at 10 candidates', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    for (let index = 0; index < 12; index += 1) {
      await createProduct(database, userId, emptyProductDraft(`Display ${index}`, 'pokemon-sealed'))
      await insertCardmarketProduct(database, 100 + index, `Booster Bundle ${index} display`)
    }

    const { candidates } = await searchProductCandidates(database, 'display', noSources)

    expect(candidates.filter(candidate => candidate.origin === 'catalogue')).toHaveLength(10)
    expect(candidates.filter(candidate => candidate.origin === 'cardmarket')).toHaveLength(10)
  })

  it('adds Cardmarket sealed candidates as pokemon-sealed drafts', async () => {
    const database = await createTestDatabase()
    await insertCardmarketProduct(database, 501, 'Scarlet & Violet Elite Trainer Box')

    const { candidates } = await searchProductCandidates(database, 'elite trainer', noSources)

    expect(candidates).toEqual([
      expect.objectContaining({
        origin: 'cardmarket',
        productId: null,
        draft: expect.objectContaining({
          name: 'Scarlet & Violet Elite Trainer Box',
          category: 'pokemon-sealed',
          cardmarketProductId: 501,
        }),
      }),
    ])
  })

  it('shows a Cardmarket product already in the catalogue once, as a catalogue candidate', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    await insertCardmarketProduct(database, 501, 'Elite Trainer Box Évolutions')
    await createProduct(database, userId, {
      ...emptyProductDraft('Elite Trainer Box Évolutions', 'pokemon-sealed'),
      cardmarketProductId: 501,
    })

    const { candidates } = await searchProductCandidates(database, 'elite trainer', noSources)

    expect(candidates.map(candidate => candidate.origin)).toEqual(['catalogue'])
  })

  it('adds TCGdex cards as graded-card drafts and shows those already in the catalogue once, as catalogue', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    await createProduct(database, userId, { ...emptyProductDraft('Dracaufeu', 'graded-card'), tcgdexCardId: 'base1-4' })
    const dependencies: ProductSearchDependencies = {
      ...noSources,
      searchTcgdexCards: async () => [
        { source: 'tcgdex', sourceCardId: 'base1-4', name: 'Dracaufeu', setName: 'Set de base', imageUrl: null },
        { source: 'tcgdex', sourceCardId: 'base2-6', name: 'Dracaufeu', setName: 'Jungle', imageUrl: 'https://img/6' },
      ],
    }

    const { candidates } = await searchProductCandidates(database, 'zzz', dependencies)

    expect(candidates).toEqual([
      expect.objectContaining({ origin: 'catalogue', label: 'Dracaufeu' }),
      expect.objectContaining({
        origin: 'tcgdex',
        imageUrl: 'https://img/6',
        draft: expect.objectContaining({ category: 'graded-card', tcgdexCardId: 'base2-6', seriesName: 'Jungle' }),
      }),
    ])
  })

  it('adds distinct eBay titles as other drafts', async () => {
    const database = await createTestDatabase()
    const dependencies: ProductSearchDependencies = {
      ...noSources,
      searchEbayListings: async () => [
        { source: 'ebay', kind: 'active', title: 'Lego 10300', priceCents: 1000, shippingCents: null, sourceCondition: null, url: 'u1', imageUrl: 'https://img/1' },
        { source: 'ebay', kind: 'active', title: 'Lego 10300', priceCents: 1200, shippingCents: null, sourceCondition: null, url: 'u2', imageUrl: null },
        { source: 'ebay', kind: 'active', title: 'Lego 10301', priceCents: 900, shippingCents: null, sourceCondition: null, url: 'u3', imageUrl: null },
      ],
    }

    const { candidates } = await searchProductCandidates(database, 'lego', dependencies)

    expect(candidates.map(candidate => candidate.label)).toEqual(['Lego 10300', 'Lego 10301'])
    expect(candidates[0]).toMatchObject({ origin: 'ebay', imageUrl: 'https://img/1', draft: { category: 'other', ebayQuery: 'lego' } })
  })

  it('reports a disabled eBay as unavailable and still returns catalogue and Cardmarket candidates', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    await createProduct(database, userId, emptyProductDraft('Display Écarlate', 'pokemon-sealed'))
    await insertCardmarketProduct(database, 7, 'Display Écarlate et Violet')
    const dependencies: ProductSearchDependencies = {
      ...noSources,
      searchEbayListings: async () => {
        throw new SourceDisabledError('ebay', 'EBAY_CLIENT_ID')
      },
    }

    const { candidates, unavailableSources } = await searchProductCandidates(database, 'display', dependencies)

    expect(candidates.map(candidate => candidate.origin)).toEqual(['catalogue', 'cardmarket'])
    expect(unavailableSources).toEqual(['ebay'])
  })

  it('reports a blocked TCGdex as unavailable', async () => {
    const database = await createTestDatabase()
    const dependencies: ProductSearchDependencies = {
      ...noSources,
      searchTcgdexCards: async () => {
        throw new SourceBlockedError('tcgdex', 'HTTP 429')
      },
    }

    const { unavailableSources } = await searchProductCandidates(database, 'dracaufeu', dependencies)

    expect(unavailableSources).toEqual(['tcgdex'])
  })

  it('lets an unexpected failure through', async () => {
    const database = await createTestDatabase()
    const dependencies: ProductSearchDependencies = {
      ...noSources,
      searchEbayListings: async () => {
        throw new Error('boom')
      },
    }

    await expect(searchProductCandidates(database, 'lego', dependencies)).rejects.toThrow('boom')
  })

  it('returns nothing for a blank query without calling sources', async () => {
    const database = await createTestDatabase()
    const dependencies: ProductSearchDependencies = {
      searchTcgdexCards: async () => {
        throw new Error('must not be called')
      },
      searchEbayListings: async () => {
        throw new Error('must not be called')
      },
    }

    expect(await searchProductCandidates(database, '   ', dependencies)).toEqual({ candidates: [], unavailableSources: [] })
  })
})
