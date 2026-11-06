import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  excludedListings,
  priceRefreshRequests,
  priceSnapshotListings,
  priceSnapshots,
  products,
  titleConditionRules,
  users,
} from '../../../server/database/schema/index.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { refreshProductPrices } from '../../../server/domain/prices/refresh-product-prices.ts'
import type { PriceSourceGateway } from '../../../server/domain/prices/refresh-product-prices.ts'
import { SourceBlockedError, SourceDisabledError } from '../../../src/price-sources/price-source-types.ts'
import type { ListingObservation, SourceAggregate } from '../../../src/price-sources/price-source-types.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')

const listing = (title: string, priceCents: number, overrides: Partial<ListingObservation> = {}): ListingObservation => ({
  source: 'ebay',
  kind: 'active',
  title,
  priceCents,
  shippingCents: null,
  sourceCondition: 'Neuf',
  url: `https://ebay.test/${encodeURIComponent(title)}-${priceCents}`,
  imageUrl: null,
  ...overrides,
})

const aggregate = (source: SourceAggregate['source'], overrides: Partial<SourceAggregate> = {}): SourceAggregate => ({
  source,
  sourceProductId: '42',
  averageCents: 5000,
  lowCents: 4000,
  trendCents: 4800,
  average7DaysCents: null,
  average30DaysCents: null,
  observedAt: '2026-11-01T00:00:00Z',
  ...overrides,
})

const fakeGateway = (overrides: Partial<PriceSourceGateway> = {}): PriceSourceGateway => ({
  searchEbay: async () => [],
  cardmarketAggregates: async () => new Map(),
  tcgdexAggregate: async () => null,
  pokemontcgAggregate: async () => null,
  ...overrides,
})

const insertProduct = async (database: KairosDatabase, overrides: Partial<typeof products.$inferInsert> = {}) => {
  const [member] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
  const [product] = await database.insert(products).values({
    name: 'Display EV1',
    category: 'pokemon-sealed',
    createdByUserId: member!.id,
    ...overrides,
  }).returning()
  return { memberId: member!.id, product: product! }
}

describe('refreshProductPrices', () => {
  it('records one sealed-new snapshot from retained listings only', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, { ebayExcludedKeywords: ['lot'] })
    const excludedByUrl = listing('Display EV1 exclue', 9000)
    await database.insert(excludedListings).values({ productId: product.id, url: excludedByUrl.url, excludedByUserId: memberId })
    const searched: string[] = []
    const gateway = fakeGateway({
      searchEbay: async (query) => {
        searched.push(query)
        return [
          listing('Display EV1 A', 10000),
          listing('Display EV1 B', 11000),
          listing('Display EV1 C', 12000),
          excludedByUrl,
          listing('Lot de 3 Display EV1', 30000),
          listing('Display EV1 hors norme', 90000),
        ]
      },
    })

    const outcome = await refreshProductPrices(database, gateway, product.id, now)

    expect(searched).toEqual(['Display EV1'])
    expect(outcome.unavailableSources).toEqual([])
    const snapshots = await database.select().from(priceSnapshots)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      source: 'ebay',
      kind: 'active',
      kairosCondition: 'sealed-new',
      listingCount: 3,
      averageCents: 11000,
      medianCents: 11000,
      lowCents: 10000,
    })
    expect(snapshots[0]!.observedAt).toEqual(now)
    expect(outcome.snapshotIds).toEqual([snapshots[0]!.id])
    const retained = await database.select().from(priceSnapshotListings).where(eq(priceSnapshotListings.snapshotId, snapshots[0]!.id))
    expect(retained.map(row => row.priceCents).sort()).toEqual([10000, 11000, 12000])
  })

  it('excludes keywords regardless of case and accents', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { ebayExcludedKeywords: ['édition'] })
    const gateway = fakeGateway({
      searchEbay: async () => [listing('Display EDITION spéciale', 5000), listing('Display simple', 6000)],
    })
    await refreshProductPrices(database, gateway, product.id, now)
    const retained = await database.select().from(priceSnapshotListings)
    expect(retained.map(row => row.priceCents)).toEqual([6000])
  })

  it('uses the custom ebay query when set', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { ebayQuery: 'EV1 display fr' })
    const searched: string[] = []
    const gateway = fakeGateway({ searchEbay: async (query) => { searched.push(query); return [] } })
    await refreshProductPrices(database, gateway, product.id, now)
    expect(searched).toEqual(['EV1 display fr'])
  })

  it('files an emptied ETB in its own opened-incomplete snapshot', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database)
    const gateway = fakeGateway({
      searchEbay: async () => [listing('ETB EV1', 5000), listing('ETB vide EV1', 1500)],
    })
    await refreshProductPrices(database, gateway, product.id, now)
    const snapshots = await database.select().from(priceSnapshots)
    expect(snapshots.map(snapshot => snapshot.kairosCondition).sort()).toEqual(['opened-incomplete', 'sealed-new'])
  })

  it('drops listings whose condition cannot be resolved', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database)
    const gateway = fakeGateway({ searchEbay: async () => [listing('Display EV1', 5000, { sourceCondition: 'Inconnu' })] })
    const outcome = await refreshProductPrices(database, gateway, product.id, now)
    expect(outcome.snapshotIds).toEqual([])
  })

  it('splits graded listings by company and grade and drops ungraded titles', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { name: 'Dracaufeu', category: 'graded-card' })
    const gateway = fakeGateway({
      searchEbay: async () => [
        listing('Dracaufeu PSA 10', 100000, { sourceCondition: null }),
        listing('Dracaufeu PSA 10 holo', 110000, { sourceCondition: null }),
        listing('Dracaufeu PSA 9', 50000, { sourceCondition: null }),
        listing('Dracaufeu sans note', 1000, { sourceCondition: null }),
      ],
    })
    await refreshProductPrices(database, gateway, product.id, now)
    const snapshots = await database.select().from(priceSnapshots)
    expect(snapshots).toHaveLength(2)
    const snapshotsByGrade = Object.fromEntries(snapshots.map(snapshot => [snapshot.grade, snapshot]))
    expect(snapshotsByGrade['10']).toMatchObject({ gradingCompany: 'PSA', kairosCondition: 'graded', listingCount: 2, medianCents: 105000 })
    expect(snapshotsByGrade['9']).toMatchObject({ gradingCompany: 'PSA', kairosCondition: 'graded', listingCount: 1 })
  })

  it('still writes the cardmarket snapshot when ebay is disabled', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { cardmarketProductId: 42 })
    const gateway = fakeGateway({
      searchEbay: async () => { throw new SourceDisabledError('ebay', 'EBAY_CLIENT_ID') },
      cardmarketAggregates: async () => new Map([[42, aggregate('cardmarket')]]),
    })
    const outcome = await refreshProductPrices(database, gateway, product.id, now)
    expect(outcome.unavailableSources).toEqual([{ source: 'ebay', kind: 'missing-key', reason: 'EBAY_CLIENT_ID is not set' }])
    const snapshots = await database.select().from(priceSnapshots)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      source: 'cardmarket',
      kind: 'source-aggregate',
      averageCents: 5000,
      lowCents: 4000,
      trendCents: 4800,
      listingCount: 0,
    })
    expect(snapshots[0]!.observedAt).toEqual(new Date('2026-11-01T00:00:00Z'))
  })

  it('writes tcgdex and pokemontcg aggregates and stamps the refresh request', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, { tcgdexCardId: 'sv1-1', pokemontcgCardId: 'sv1-1' })
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedByUserId: memberId })
    const gateway = fakeGateway({
      tcgdexAggregate: async () => aggregate('tcgdex'),
      pokemontcgAggregate: async () => aggregate('pokemontcg'),
    })
    await refreshProductPrices(database, gateway, product.id, now)
    const snapshots = await database.select().from(priceSnapshots)
    expect(snapshots.map(snapshot => snapshot.source).sort()).toEqual(['pokemontcg', 'tcgdex'])
    const [request] = await database.select().from(priceRefreshRequests)
    expect(request!.lastRefreshedAt).toEqual(now)
  })

  it('keeps the other sources when one fails with an unexpected error', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { tcgdexCardId: 'sv1-1', pokemontcgCardId: 'sv1-1' })
    const gateway = fakeGateway({
      tcgdexAggregate: async () => { throw new Error('HTTP 500') },
      pokemontcgAggregate: async () => aggregate('pokemontcg'),
    })
    const outcome = await refreshProductPrices(database, gateway, product.id, now)
    expect(outcome.unavailableSources).toEqual([{ source: 'tcgdex', kind: 'error', reason: 'error: HTTP 500' }])
    const snapshots = await database.select().from(priceSnapshots)
    expect(snapshots.map(snapshot => snapshot.source)).toEqual(['pokemontcg'])
  })

  it('reports a source that blocked the request as blocked and keeps the others', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { cardmarketProductId: 42 })
    const gateway = fakeGateway({
      searchEbay: async () => [listing('Display EV1 A', 10000)],
      cardmarketAggregates: async () => { throw new SourceBlockedError('cardmarket', 'HTTP 403') },
    })

    const outcome = await refreshProductPrices(database, gateway, product.id, now)

    expect(outcome.unavailableSources).toEqual([{ source: 'cardmarket', kind: 'blocked', reason: 'HTTP 403' }])
    expect((await database.select().from(priceSnapshots)).map(snapshot => snapshot.source)).toEqual(['ebay'])
  })

  it('does not ask Cardmarket for a product without a Cardmarket id', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database)
    let cardmarketRequestCount = 0
    const gateway = fakeGateway({
      cardmarketAggregates: async () => {
        cardmarketRequestCount += 1
        return new Map([[42, aggregate('cardmarket')]])
      },
    })

    await refreshProductPrices(database, gateway, product.id, now)

    expect(cardmarketRequestCount).toBe(0)
    expect(await database.select().from(priceSnapshots)).toEqual([])
  })

  it('writes no snapshot and no refresh stamp when one snapshot of the refresh cannot be stored', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database, { cardmarketProductId: 42 })
    const gateway = fakeGateway({
      searchEbay: async () => [listing('Display EV1 A', 10000)],
      cardmarketAggregates: async () => new Map([[42, aggregate('cardmarket', { averageCents: 5000.5 })]]),
    })

    await expect(refreshProductPrices(database, gateway, product.id, now)).rejects.toMatchObject({ cause: { code: '22P02' } })

    expect(await database.select().from(priceSnapshots)).toEqual([])
    expect(await database.select().from(priceRefreshRequests)).toEqual([])
  })

  it('matches exclusions ignoring query string and hash', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database)
    await database.insert(excludedListings).values({
      productId: product.id, url: 'https://ebay.test/itm/1?hash=abc', excludedByUserId: memberId,
    })
    const gateway = fakeGateway({
      searchEbay: async () => [
        listing('Display exclue', 9000, { url: 'https://ebay.test/itm/1?_trkparms=zzz#top' }),
        listing('Display gardée', 6000, { url: 'https://ebay.test/itm/2' }),
      ],
    })
    await refreshProductPrices(database, gateway, product.id, now)
    const retained = await database.select().from(priceSnapshotListings)
    expect(retained.map(row => row.priceCents)).toEqual([6000])
  })

  it('applies a stored keyword rule to the listing titles', async () => {
    const database = await createTestDatabase()
    const { product } = await insertProduct(database)
    await database.insert(titleConditionRules).values({ category: 'pokemon-sealed', keywords: ['display'], kairosCondition: 'opened-complete', priority: 99 })
    const gateway = fakeGateway({ searchEbay: async () => [listing('Display EV1', 5000)] })
    const outcome = await refreshProductPrices(database, gateway, product.id, now)
    expect(outcome.snapshotIds).toHaveLength(1)
    const [snapshot] = await database.select().from(priceSnapshots)
    expect(snapshot!.kairosCondition).toBe('opened-complete')
  })
})
