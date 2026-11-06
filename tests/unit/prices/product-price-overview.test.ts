import { describe, expect, it } from 'vitest'
import { excludedListings, priceRefreshRequests, priceSnapshotListings, priceSnapshots, products, users } from '../../../server/database/schema/index.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { productPriceOverview } from '../../../server/domain/prices/product-price-overview.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')
const daysBefore = (days: number, hours = 0): Date => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)

const insertProduct = async (database: KairosDatabase, category = 'pokemon-sealed') => {
  const [member] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
  const [product] = await database.insert(products).values({ name: 'Display', category, createdByUserId: member!.id }).returning()
  return product!
}

const insertSnapshot = async (database: KairosDatabase, productId: string, overrides: Partial<typeof priceSnapshots.$inferInsert>) => {
  const [snapshot] = await database
    .insert(priceSnapshots)
    .values({
      productId,
      source: 'ebay',
      kind: 'active',
      kairosCondition: 'sealed-new',
      observedAt: now,
      medianCents: 10000,
      listingCount: 3,
      ...overrides,
    })
    .returning()
  return snapshot!
}

describe('productPriceOverview', () => {
  it('keeps one history point per source, condition and Paris day, taking the last snapshot of the day', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    await insertSnapshot(database, product.id, { observedAt: daysBefore(1, 5), medianCents: 9000 })
    await insertSnapshot(database, product.id, { observedAt: daysBefore(1, 1), medianCents: 9500 })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.history).toEqual([
      { source: 'ebay', condition: 'sealed-new', gradingCompany: null, grade: null, observedOn: '2026-11-01', figureCents: 9500 },
    ])
  })

  it('separates days by the Paris calendar date', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    await insertSnapshot(database, product.id, { observedAt: new Date('2026-10-31T23:30:00Z'), medianCents: 9000 })
    await insertSnapshot(database, product.id, { observedAt: new Date('2026-10-31T21:30:00Z'), medianCents: 8000 })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.history.map(point => point.observedOn)).toEqual(['2026-10-31', '2026-11-01'])
  })

  it('shows a 10-day-old snapshot in the history and flags it stale in the table', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    const staleSnapshot = await insertSnapshot(database, product.id, { observedAt: daysBefore(10), medianCents: 8800 })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.history).toHaveLength(1)
    expect(overview.bySourceAndCondition).toEqual([
      expect.objectContaining({ source: 'ebay', condition: 'sealed-new', figureCents: 8800, snapshotId: staleSnapshot.id, isStale: true }),
    ])
  })

  it('marks a snapshot within 7 days as fresh and exposes its retained listings', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    const snapshot = await insertSnapshot(database, product.id, { observedAt: daysBefore(2), listingCount: 1 })
    await database.insert(priceSnapshotListings).values({ snapshotId: snapshot.id, title: 'Display scellé', priceCents: 9900, url: 'https://ebay.fr/itm/1' })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.bySourceAndCondition[0]).toMatchObject({ isStale: false, listingCount: 1 })
    expect(overview.bySourceAndCondition[0]!.listings).toEqual([
      {
        title: 'Display scellé',
        priceCents: 9900,
        shippingCents: null,
        sourceCondition: null,
        url: 'https://ebay.fr/itm/1',
        imageUrl: null,
        observedAt: null,
        authorName: null,
        isExcluded: false,
      },
    ])
  })

  it('uses the newest snapshot per cell and skips snapshots without a figure', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    await insertSnapshot(database, product.id, { observedAt: daysBefore(3), medianCents: 9000 })
    await insertSnapshot(database, product.id, { observedAt: daysBefore(1), medianCents: null })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.bySourceAndCondition).toHaveLength(1)
    expect(overview.bySourceAndCondition[0]!.figureCents).toBe(9000)
    expect(overview.history).toHaveLength(1)
  })

  it('files Cardmarket aggregates under sealed-new for sealed Pokémon and ignores them for other categories', async () => {
    const database = await createTestDatabase()
    const sealedProduct = await insertProduct(database)
    await insertSnapshot(database, sealedProduct.id, {
      source: 'cardmarket', kind: 'source-aggregate', kairosCondition: null, medianCents: null, averageCents: 12000, trendCents: 11000,
    })
    const [member] = await database.select().from(users)
    const [toy] = await database.insert(products).values({ name: 'Peluche', category: 'toy', createdByUserId: member!.id }).returning()
    await insertSnapshot(database, toy!.id, {
      source: 'cardmarket', kind: 'source-aggregate', kairosCondition: null, medianCents: null, averageCents: 12000,
    })

    const sealedOverview = await productPriceOverview(database, sealedProduct.id, now)
    const toyOverview = await productPriceOverview(database, toy!.id, now)

    expect(sealedOverview.bySourceAndCondition).toEqual([
      expect.objectContaining({ source: 'cardmarket', condition: 'sealed-new', figureCents: 12000 }),
    ])
    expect(toyOverview.bySourceAndCondition).toEqual([])
  })

  it('lists tcgdex and pokemontcg aggregates as card references, apart from the table', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'graded-card')
    await insertSnapshot(database, product.id, {
      source: 'tcgdex', kind: 'source-aggregate', kairosCondition: null, medianCents: null, averageCents: 500, lowCents: 300, trendCents: 450,
    })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.bySourceAndCondition).toEqual([])
    expect(overview.cardReferences).toEqual([
      expect.objectContaining({ source: 'tcgdex', averageCents: 500, lowCents: 300, trendCents: 450 }),
    ])
  })

  it('flags a card reference older than 7 days as stale', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'graded-card')
    const aggregate = { kind: 'source-aggregate' as const, kairosCondition: null, medianCents: null, averageCents: 500 }
    await insertSnapshot(database, product.id, { ...aggregate, source: 'tcgdex', observedAt: daysBefore(8) })
    await insertSnapshot(database, product.id, { ...aggregate, source: 'pokemontcg', observedAt: daysBefore(1) })

    const overview = await productPriceOverview(database, product.id, now)

    expect(Object.fromEntries(overview.cardReferences.map(reference => [reference.source, reference.isStale])))
      .toEqual({ tcgdex: true, pokemontcg: false })
  })

  it('takes the median of manual entries within 7 days for a cell, and one column per grading company and grade', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'graded-card')
    const graded = { kind: 'manual' as const, kairosCondition: 'graded', gradingCompany: 'PSA', listingCount: 1 }
    await insertSnapshot(database, product.id, { ...graded, source: 'vinted', grade: '10', observedAt: daysBefore(1), medianCents: 10000 })
    await insertSnapshot(database, product.id, { ...graded, source: 'vinted', grade: '10', observedAt: daysBefore(2), medianCents: 14000 })
    await insertSnapshot(database, product.id, { ...graded, source: 'vinted', grade: '10', observedAt: daysBefore(3), medianCents: 30000 })
    await insertSnapshot(database, product.id, { ...graded, source: 'vinted', grade: '9', observedAt: daysBefore(1), medianCents: 5000 })

    const overview = await productPriceOverview(database, product.id, now)

    const psaTen = overview.bySourceAndCondition.find(cell => cell.grade === '10')
    expect(psaTen).toMatchObject({ source: 'vinted', condition: 'graded', gradingCompany: 'PSA', figureCents: 14000, listingCount: 3, isStale: false })
    expect(overview.bySourceAndCondition.map(cell => cell.grade).sort()).toEqual(['10', '9'])
  })

  it('reports the last refresh and drops history older than 365 days', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    await insertSnapshot(database, product.id, { observedAt: daysBefore(400), medianCents: 7000 })
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: null, lastRefreshedAt: daysBefore(0, 2) })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.history).toEqual([])
    expect(overview.lastRefreshedAt).toEqual(daysBefore(0, 2))
  })

  it('lists every fresh manual entry of a cell with its price, date, author and link or the manual placeholder', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    const [member] = await database.select().from(users)
    const manual = { source: 'vinted', kind: 'manual' as const, listingCount: 1, createdByUserId: member!.id }
    const linked = await insertSnapshot(database, product.id, { ...manual, observedAt: daysBefore(1), medianCents: 10000 })
    await insertSnapshot(database, product.id, { ...manual, observedAt: daysBefore(2), medianCents: 14000 })
    await insertSnapshot(database, product.id, { ...manual, observedAt: daysBefore(20), medianCents: 30000 })
    await database.insert(priceSnapshotListings).values({ snapshotId: linked.id, title: 'Relevé manuel', priceCents: 10000, url: 'https://www.vinted.fr/items/1' })

    const overview = await productPriceOverview(database, product.id, now)

    const manualCell = overview.bySourceAndCondition[0]!
    expect(manualCell.figureCents).toBe(12000)
    expect(manualCell.listings).toEqual([
      expect.objectContaining({ title: 'Prix saisi manuellement', priceCents: 10000, url: 'https://www.vinted.fr/items/1', authorName: 'A', observedAt: daysBefore(1) }),
      expect.objectContaining({ title: 'Prix saisi manuellement', priceCents: 14000, url: null, authorName: 'A', observedAt: daysBefore(2) }),
    ])
  })

  it('exposes the excluded listing urls, flags excluded retained listings and reports a pending refresh', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    const [member] = await database.select().from(users)
    const snapshot = await insertSnapshot(database, product.id, { observedAt: daysBefore(1), listingCount: 2 })
    await database.insert(priceSnapshotListings).values([
      { snapshotId: snapshot.id, title: 'A', priceCents: 9000, url: 'https://ebay.fr/itm/1?hash=x' },
      { snapshotId: snapshot.id, title: 'B', priceCents: 9500, url: 'https://ebay.fr/itm/2' },
    ])
    await database.insert(excludedListings).values({ productId: product.id, url: 'https://ebay.fr/itm/1', excludedByUserId: member!.id })
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: now })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.excludedListingUrls).toEqual(['https://ebay.fr/itm/1'])
    expect(overview.isRefreshPending).toBe(true)
    expect(overview.bySourceAndCondition[0]!.listings.map(listing => [listing.title, listing.isExcluded])).toEqual([['A', true], ['B', false]])
  })

  it('reports no pending refresh when nothing is queued', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database)
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: null })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.isRefreshPending).toBe(false)
    expect(overview.excludedListingUrls).toEqual([])
  })

  it('answers 404 for an unknown product', async () => {
    const database = await createTestDatabase()
    await expect(productPriceOverview(database, '00000000-0000-0000-0000-000000000000', now)).rejects.toMatchObject({ statusCode: 404 })
  })
})
