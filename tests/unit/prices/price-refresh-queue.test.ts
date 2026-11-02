import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  priceRefreshRequests,
  products,
  purchases,
  stockItems,
  users,
} from '../../../server/database/schema/index.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import {
  enqueueHeldProducts,
  enqueueProducts,
  enqueueUserHeldProducts,
  refreshProductNow,
  takeNextRefreshBatch,
} from '../../../server/domain/prices/price-refresh-queue.ts'
import { startOfParisDay } from '../../../server/domain/prices/start-of-paris-day.ts'
import type { PriceSourceGateway } from '../../../server/domain/prices/refresh-product-prices.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')

const countingGateway = () => {
  const calls = { ebay: 0 }
  const gateway: PriceSourceGateway = {
    searchEbay: async () => {
      calls.ebay += 1
      return []
    },
    cardmarketAggregates: async () => new Map(),
    tcgdexAggregate: async () => null,
    pokemontcgAggregate: async () => null,
  }
  return { gateway, calls }
}

const insertMember = async (database: KairosDatabase, email = 'a@x.fr') => {
  const [member] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return member!
}

const insertProduct = async (database: KairosDatabase, createdByUserId: string, name = 'Display EV1') => {
  const [product] = await database.insert(products).values({ name, category: 'pokemon-sealed', createdByUserId }).returning()
  return product!
}

const insertStockItem = async (database: KairosDatabase, ownerId: string, productId: string, status: string) => {
  const [purchase] = await database.insert(purchases).values({ ownerId, purchasedOn: '2026-10-01', totalPriceCents: 1000 }).returning()
  await database.insert(stockItems).values({
    ownerId,
    productId,
    purchaseId: purchase!.id,
    condition: 'sealed-new',
    allocatedPurchaseCents: 1000,
    status,
  })
}

describe('startOfParisDay', () => {
  it('returns local midnight in winter and summer', () => {
    expect(startOfParisDay(new Date('2026-11-02T12:00:00Z')).toISOString()).toBe('2026-11-01T23:00:00.000Z')
    expect(startOfParisDay(new Date('2026-07-02T12:00:00Z')).toISOString()).toBe('2026-07-01T22:00:00.000Z')
    expect(startOfParisDay(new Date('2026-11-02T23:30:00Z')).toISOString()).toBe('2026-11-02T23:00:00.000Z')
  })
})

describe('enqueueHeldProducts', () => {
  it('enqueues products held by any user and skips products held only by sold items', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const heldProduct = await insertProduct(database, member.id, 'Held')
    const transitProduct = await insertProduct(database, member.id, 'Transit')
    const soldProduct = await insertProduct(database, member.id, 'Sold')
    await insertStockItem(database, member.id, heldProduct.id, 'in-stock')
    await insertStockItem(database, member.id, transitProduct.id, 'in-transit')
    await insertStockItem(database, member.id, soldProduct.id, 'sold')

    const queuedCount = await enqueueHeldProducts(database, now)

    expect(queuedCount).toBe(2)
    const queued = await database.select().from(priceRefreshRequests)
    expect(queued.map(row => row.productId).sort()).toEqual([heldProduct.id, transitProduct.id].sort())
  })

  it('skips products already refreshed since local midnight', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const freshProduct = await insertProduct(database, member.id, 'Fresh')
    const staleProduct = await insertProduct(database, member.id, 'Stale')
    await insertStockItem(database, member.id, freshProduct.id, 'in-stock')
    await insertStockItem(database, member.id, staleProduct.id, 'in-stock')
    await database.insert(priceRefreshRequests).values([
      { productId: freshProduct.id, requestedAt: null, lastRefreshedAt: new Date('2026-11-02T00:30:00Z') },
      { productId: staleProduct.id, requestedAt: null, lastRefreshedAt: new Date('2026-11-01T22:30:00Z') },
    ])

    const queuedCount = await enqueueHeldProducts(database, now)

    expect(queuedCount).toBe(1)
    const [stale] = await database.select().from(priceRefreshRequests).where(eq(priceRefreshRequests.productId, staleProduct.id))
    expect(stale!.requestedAt).toEqual(now)
    expect(stale!.lastRefreshedAt).toEqual(new Date('2026-11-01T22:30:00Z'))
    const [fresh] = await database.select().from(priceRefreshRequests).where(eq(priceRefreshRequests.productId, freshProduct.id))
    expect(fresh!.requestedAt).toBeNull()
  })
})

describe('enqueueProducts', () => {
  it('keeps one row per product and the earliest requestedAt', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const earlier = new Date('2026-11-02T10:00:00Z')

    await enqueueProducts(database, [product.id], member.id, now)
    await enqueueProducts(database, [product.id], member.id, earlier)
    await enqueueProducts(database, [product.id], member.id, new Date('2026-11-02T13:00:00Z'))

    const rows = await database.select().from(priceRefreshRequests)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.requestedAt).toEqual(earlier)
  })

  it('does nothing for an empty list', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    await enqueueProducts(database, [], member.id, now)
    expect(await database.select().from(priceRefreshRequests)).toHaveLength(0)
  })
})

describe('enqueueUserHeldProducts', () => {
  it('enqueues only the products the user holds and returns their count', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const other = await insertMember(database, 'b@x.fr')
    const mine = await insertProduct(database, member.id, 'Mine')
    const sold = await insertProduct(database, member.id, 'Sold')
    const theirs = await insertProduct(database, member.id, 'Theirs')
    await insertStockItem(database, member.id, mine.id, 'in-stock')
    await insertStockItem(database, member.id, mine.id, 'in-transit')
    await insertStockItem(database, member.id, sold.id, 'sold')
    await insertStockItem(database, other.id, theirs.id, 'in-stock')

    const queuedProductCount = await enqueueUserHeldProducts(database, member.id, now)

    expect(queuedProductCount).toBe(1)
    const rows = await database.select().from(priceRefreshRequests)
    expect(rows.map(row => row.productId)).toEqual([mine.id])
    expect(rows[0]!.requestedByUserId).toBe(member.id)
  })
})

describe('takeNextRefreshBatch', () => {
  it('takes the 20 oldest of 25 and leaves 5 queued', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const productIds: string[] = []
    for (let index = 0; index < 25; index += 1) {
      const product = await insertProduct(database, member.id, `Product ${index}`)
      productIds.push(product.id)
      await enqueueProducts(database, [product.id], member.id, new Date(now.getTime() + index * 1000))
    }

    const batch = await takeNextRefreshBatch(database)

    expect(batch).toEqual(productIds.slice(0, 20))
    const stillQueued = (await database.select().from(priceRefreshRequests)).filter(row => row.requestedAt !== null)
    expect(stillQueued.map(row => row.productId).sort()).toEqual(productIds.slice(20).sort())
    expect(await takeNextRefreshBatch(database)).toEqual(productIds.slice(20))
    expect(await takeNextRefreshBatch(database)).toEqual([])
  })

  it('keeps lastRefreshedAt of taken products', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const refreshedAt = new Date('2026-11-01T22:30:00Z')
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: now, lastRefreshedAt: refreshedAt })

    await takeNextRefreshBatch(database)

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.requestedAt).toBeNull()
    expect(row!.lastRefreshedAt).toEqual(refreshedAt)
  })
})

describe('refreshProductNow', () => {
  it('refuses a second refresh within 10 minutes and calls the gateway once', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const { gateway, calls } = countingGateway()

    await refreshProductNow(database, gateway, product.id, member.id, now)
    const refusal = await refreshProductNow(database, gateway, product.id, member.id, new Date(now.getTime() + 5 * 60_000))
      .catch((error: unknown) => error)

    expect(refusal).toMatchObject({ statusCode: 429, statusMessage: 'déjà relevé il y a moins de 10 minutes' })
    expect(calls.ebay).toBe(1)
  })

  it('allows a refresh after 10 minutes', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const { gateway, calls } = countingGateway()

    await refreshProductNow(database, gateway, product.id, member.id, now)
    await refreshProductNow(database, gateway, product.id, member.id, new Date(now.getTime() + 10 * 60_000))

    expect(calls.ebay).toBe(2)
  })

  it('lets only one of two concurrent refreshes through', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const { gateway, calls } = countingGateway()

    const outcomes = await Promise.allSettled([
      refreshProductNow(database, gateway, product.id, member.id, now),
      refreshProductNow(database, gateway, product.id, member.id, now),
    ])

    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(calls.ebay).toBe(1)
  })

  it('answers 404 for an unknown product', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const { gateway } = countingGateway()
    const refusal = await refreshProductNow(database, gateway, '00000000-0000-4000-8000-000000000000', member.id, now)
      .catch((error: unknown) => error)
    expect(refusal).toMatchObject({ statusCode: 404 })
  })
})
