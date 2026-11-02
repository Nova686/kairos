import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { excludedListings, priceRefreshRequests, priceSnapshotListings, priceSnapshots, products, users } from '../../../server/database/schema/index.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { listProductChanges } from '../../../server/domain/catalogue/catalogue-journal.ts'
import { excludeListing, restoreListing } from '../../../server/domain/prices/listing-exclusions.ts'
import { refreshProductPrices } from '../../../server/domain/prices/refresh-product-prices.ts'
import type { PriceSourceGateway } from '../../../server/domain/prices/refresh-product-prices.ts'
import type { ListingObservation } from '../../../src/price-sources/price-source-types.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')

const listing = (title: string, priceCents: number, url: string): ListingObservation => ({
  source: 'ebay',
  kind: 'active',
  title,
  priceCents,
  shippingCents: null,
  sourceCondition: 'Neuf',
  url,
  imageUrl: null,
})

const gatewayWith = (listings: ListingObservation[]): PriceSourceGateway => ({
  searchEbay: async () => listings,
  cardmarketAggregates: async () => new Map(),
  tcgdexAggregate: async () => null,
  pokemontcgAggregate: async () => null,
})

const insertProduct = async (database: KairosDatabase) => {
  const [member] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
  const [product] = await database.insert(products).values({ name: 'Display EV1', category: 'pokemon-sealed', createdByUserId: member!.id }).returning()
  return { memberId: member!.id, product: product! }
}

const retainedUrlsOf = async (database: KairosDatabase, snapshotIds: string[]): Promise<string[]> => {
  const listings = await database.select().from(priceSnapshotListings)
  const snapshotRows = await database.select().from(priceSnapshots)
  const ownIds = new Set(snapshotRows.filter(row => snapshotIds.includes(row.id)).map(row => row.id))
  return listings.filter(row => ownIds.has(row.snapshotId)).map(row => row.url).sort()
}

const keptListing = listing('Display EV1 A', 5000, 'https://ebay.test/itm/1')
const otherListing = listing('Display EV1 B', 6000, 'https://ebay.test/itm/2')

describe('excludeListing and restoreListing', () => {
  it('drops an excluded listing at the next refresh and brings it back once restored', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database)
    const gateway = gatewayWith([keptListing, otherListing])

    await excludeListing(database, memberId, product.id, 'https://ebay.test/itm/2?hash=abc#top')
    const afterExclusion = await refreshProductPrices(database, gateway, product.id, now)
    expect(await retainedUrlsOf(database, afterExclusion.snapshotIds)).toEqual(['https://ebay.test/itm/1'])

    await restoreListing(database, memberId, product.id, 'https://ebay.test/itm/2')
    const afterRestore = await refreshProductPrices(database, gateway, product.id, now)
    expect(await retainedUrlsOf(database, afterRestore.snapshotIds)).toEqual(['https://ebay.test/itm/1', 'https://ebay.test/itm/2'])
  })

  it('stores the normalised url and journals both directions', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database)

    await excludeListing(database, memberId, product.id, 'https://ebay.test/itm/2?hash=abc')
    const [stored] = await database.select().from(excludedListings)
    expect(stored).toMatchObject({ productId: product.id, url: 'https://ebay.test/itm/2', excludedByUserId: memberId })

    await restoreListing(database, memberId, product.id, 'https://ebay.test/itm/2?other=1')
    expect(await database.select().from(excludedListings)).toHaveLength(0)

    const changes = await listProductChanges(database, product.id)
    expect(changes).toHaveLength(2)
    expect(changes[0]).toMatchObject({ subject: 'product', fieldName: 'excludedListing', previousValue: null, newValue: 'https://ebay.test/itm/2', userId: memberId })
    expect(changes[1]).toMatchObject({ fieldName: 'excludedListing', previousValue: 'https://ebay.test/itm/2', newValue: null })
  })

  it('marks the product for refresh in the queue on both operations', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database)

    await excludeListing(database, memberId, product.id, 'https://ebay.test/itm/2')
    const [afterExclusion] = await database.select().from(priceRefreshRequests).where(eq(priceRefreshRequests.productId, product.id))
    expect(afterExclusion!.requestedAt).not.toBeNull()

    await database.update(priceRefreshRequests).set({ requestedAt: null })
    await restoreListing(database, memberId, product.id, 'https://ebay.test/itm/2')
    const [afterRestore] = await database.select().from(priceRefreshRequests).where(eq(priceRefreshRequests.productId, product.id))
    expect(afterRestore!.requestedAt).not.toBeNull()
  })

  it('does not duplicate the exclusion or the journal entry when excluding twice', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database)

    await excludeListing(database, memberId, product.id, 'https://ebay.test/itm/2')
    await excludeListing(database, memberId, product.id, 'https://ebay.test/itm/2?x=1')

    expect(await database.select().from(excludedListings)).toHaveLength(1)
    expect(await listProductChanges(database, product.id)).toHaveLength(1)
  })

  it('answers 404 for an unknown product', async () => {
    const database = await createTestDatabase()
    const { memberId } = await insertProduct(database)

    await expect(excludeListing(database, memberId, '00000000-0000-4000-8000-000000000000', 'https://ebay.test/itm/2'))
      .rejects.toMatchObject({ statusCode: 404 })
    await expect(restoreListing(database, memberId, 'not-a-uuid', 'https://ebay.test/itm/2'))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
