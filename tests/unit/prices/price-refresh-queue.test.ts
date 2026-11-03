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
  processRefreshQueue,
  refreshProductNow,
  takeNextRefreshBatch,
} from '../../../server/domain/prices/price-refresh-queue.ts'
import { refreshProductPrices } from '../../../server/domain/prices/refresh-product-prices.ts'
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

describe('enqueueUserHeldProducts quota guard', () => {
  it('skips products refreshed since the start of the Paris day and products already queued', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const refreshedToday = await insertProduct(database, member.id, 'Refreshed today')
    const refreshedYesterday = await insertProduct(database, member.id, 'Refreshed yesterday')
    const alreadyQueued = await insertProduct(database, member.id, 'Already queued')
    const neverRefreshed = await insertProduct(database, member.id, 'Never refreshed')
    for (const product of [refreshedToday, refreshedYesterday, alreadyQueued, neverRefreshed]) {
      await insertStockItem(database, member.id, product.id, 'in-stock')
    }
    const earlierQueueing = new Date(now.getTime() - 60 * 60_000)
    await database.insert(priceRefreshRequests).values([
      { productId: refreshedToday.id, requestedAt: null, lastRefreshedAt: startOfParisDay(now) },
      { productId: refreshedYesterday.id, requestedAt: null, lastRefreshedAt: new Date(startOfParisDay(now).getTime() - 1000) },
      { productId: alreadyQueued.id, requestedAt: earlierQueueing, requestedByUserId: null },
    ])

    const queuedProductCount = await enqueueUserHeldProducts(database, member.id, now)

    expect(queuedProductCount).toBe(2)
    const rows = await database.select().from(priceRefreshRequests)
    const requestedAtByProduct = new Map(rows.map(row => [row.productId, row.requestedAt]))
    expect(requestedAtByProduct.get(refreshedToday.id)).toBeNull()
    expect(requestedAtByProduct.get(refreshedYesterday.id)).toEqual(now)
    expect(requestedAtByProduct.get(alreadyQueued.id)).toEqual(earlierQueueing)
    expect(requestedAtByProduct.get(neverRefreshed.id)).toEqual(now)
    expect(rows.find(row => row.productId === alreadyQueued.id)!.requestedByUserId).toBeNull()
  })
})

describe('refreshProductNow and the queue', () => {
  it('clears the pending queue row of the refreshed product', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    await enqueueProducts(database, [product.id], member.id, new Date(now.getTime() - 60_000))
    const { gateway } = countingGateway()

    await refreshProductNow(database, gateway, product.id, member.id, now)

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.requestedAt).toBeNull()
  })

  it('keeps a queue request made after the refresh started', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const laterRequest = new Date(now.getTime() + 1000)
    const { gateway } = countingGateway()
    const queuingGateway: PriceSourceGateway = {
      ...gateway,
      searchEbay: async (query) => {
        await enqueueProducts(database, [product.id], member.id, laterRequest)
        return gateway.searchEbay(query)
      },
    }

    await refreshProductNow(database, queuingGateway, product.id, member.id, now)

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.requestedAt).toEqual(laterRequest)
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

    const batch = await takeNextRefreshBatch(database, now)

    expect(batch).toEqual(productIds.slice(0, 20))
    const unclaimed = (await database.select().from(priceRefreshRequests)).filter(row => row.claimedAt === null)
    expect(unclaimed.map(row => row.productId).sort()).toEqual(productIds.slice(20).sort())
    expect(await takeNextRefreshBatch(database, now)).toEqual(productIds.slice(20))
    expect(await takeNextRefreshBatch(database, now)).toEqual([])
  })

  it('keeps taken products queued until processed and hands them out again once the claim expires', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    await enqueueProducts(database, [product.id], member.id, now)

    expect(await takeNextRefreshBatch(database, now)).toEqual([product.id])
    const [claimedRow] = await database.select().from(priceRefreshRequests)
    expect(claimedRow).toMatchObject({ requestedAt: now, claimedAt: now })
    expect(await takeNextRefreshBatch(database, new Date(now.getTime() + 29 * 60_000))).toEqual([])
    expect(await takeNextRefreshBatch(database, new Date(now.getTime() + 31 * 60_000))).toEqual([product.id])
  })

  it('keeps lastRefreshedAt of taken products', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const refreshedAt = new Date('2026-11-01T22:30:00Z')
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: now, lastRefreshedAt: refreshedAt })

    await takeNextRefreshBatch(database, now)

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.claimedAt).toEqual(now)
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

const failingRefresh = async (): Promise<never> => {
  throw new Error('boom')
}

describe('refreshProductNow failure', () => {
  it('releases the claim when the refresh throws and rethrows', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const previousRefresh = new Date('2026-11-02T08:00:00Z')
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: null, lastRefreshedAt: previousRefresh })
    const failingDatabase = Object.assign(Object.create(database), {
      transaction: failingRefresh,
    }) as KairosDatabase
    const { gateway, calls } = countingGateway()

    await expect(refreshProductNow(failingDatabase, gateway, product.id, member.id, now)).rejects.toThrow('boom')

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.lastRefreshedAt).toEqual(previousRefresh)
    await refreshProductNow(database, gateway, product.id, member.id, new Date(now.getTime() + 1000))
    expect(calls.ebay).toBe(2)
  })

  it('clears the claim of a never-refreshed product when the refresh throws', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const failingDatabase = Object.assign(Object.create(database), {
      transaction: failingRefresh,
    }) as KairosDatabase
    const { gateway } = countingGateway()

    await expect(refreshProductNow(failingDatabase, gateway, product.id, member.id, now)).rejects.toThrow('boom')

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.lastRefreshedAt).toBeNull()
  })
})

describe('refreshProductNow refusal details', () => {
  it('carries the remaining time for the interface', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    const { gateway } = countingGateway()

    await refreshProductNow(database, gateway, product.id, member.id, now)
    const refusal = await refreshProductNow(database, gateway, product.id, member.id, new Date(now.getTime() + 4 * 60_000 + 30_000))
      .catch((error: unknown) => error)

    expect(refusal).toMatchObject({
      statusCode: 429,
      data: { retryAfterSeconds: 330, remainingMinutes: 6 },
    })
  })
})

describe('processRefreshQueue', () => {
  const queuedProduct = async (database: KairosDatabase, memberId: string, name: string) => {
    const product = await insertProduct(database, memberId, name)
    await enqueueProducts(database, [product.id], memberId, now)
    return product
  }

  it('refreshes the batch and reports the counts', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    await queuedProduct(database, member.id, 'One')
    await queuedProduct(database, member.id, 'Two')
    const { gateway, calls } = countingGateway()

    const outcome = await processRefreshQueue(database, gateway, now)

    expect(outcome).toEqual({ refreshedProductCount: 2, failedProductCount: 0 })
    expect(calls.ebay).toBe(2)
  })

  it('re-enqueues a failed product, up to 3 attempts, and logs the failure', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await queuedProduct(database, member.id, 'Flaky')
    const { gateway } = countingGateway()
    const logged: unknown[][] = []
    const logFailure = (...details: unknown[]) => { logged.push(details) }

    for (const expectedQueued of [true, true, false]) {
      await processRefreshQueue(database, gateway, now, { refreshProduct: failingRefresh, logFailure })
      const [row] = await database.select().from(priceRefreshRequests).where(eq(priceRefreshRequests.productId, product.id))
      expect(row!.requestedAt !== null).toBe(expectedQueued)
    }

    expect(logged).toHaveLength(3)
    expect(logged[0]).toContain(product.id)
    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.attempts).toBe(3)
    expect(await takeNextRefreshBatch(database, new Date(now.getTime() + 60 * 60_000))).toEqual([])
  })

  it('dequeues a product once refreshed and leaves the products of a crashed run to the next one', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const refreshedProduct = await queuedProduct(database, member.id, 'Refreshed')
    const crashedProduct = await insertProduct(database, member.id, 'Crashed')
    await enqueueProducts(database, [crashedProduct.id], member.id, new Date(now.getTime() + 1000))
    const { gateway } = countingGateway()
    const crashingRefresh = async (...parameters: Parameters<typeof refreshProductPrices>) => {
      if (parameters[2] === crashedProduct.id) {
        throw new Error('worker killed')
      }
      return refreshProductPrices(...parameters)
    }

    await expect(processRefreshQueue(database, gateway, now, {
      refreshProduct: crashingRefresh,
      logFailure: () => { throw new Error('process died') },
    })).rejects.toThrow('process died')

    const rows = await database.select().from(priceRefreshRequests)
    const rowOf = (productId: string) => rows.find(row => row.productId === productId)!
    expect(rowOf(refreshedProduct.id)).toMatchObject({ requestedAt: null, claimedAt: null })
    expect(rowOf(crashedProduct.id).requestedAt).not.toBeNull()
    expect(await takeNextRefreshBatch(database, new Date(now.getTime() + 31 * 60_000))).toEqual([crashedProduct.id])
  })

  it('warns with the product id when a source is unavailable', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await queuedProduct(database, member.id, 'Key expired')
    const { gateway } = countingGateway()
    const unavailableSources = [{ source: 'ebay', kind: 'missing-key' as const, reason: 'EBAY_CLIENT_ID is not set' }]
    const warnings: unknown[][] = []

    await processRefreshQueue(database, gateway, now, {
      refreshProduct: async () => ({ snapshotIds: [], unavailableSources }),
      logUnavailableSources: (...details: unknown[]) => { warnings.push(details) },
    })

    expect(warnings).toEqual([['Price sources unavailable', product.id, unavailableSources]])
  })

  it('does not warn when every source answered', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    await queuedProduct(database, member.id, 'All good')
    const { gateway } = countingGateway()
    const warnings: unknown[][] = []

    await processRefreshQueue(database, gateway, now, {
      logUnavailableSources: (...details: unknown[]) => { warnings.push(details) },
    })

    expect(warnings).toEqual([])
  })

  it('lets the daily enqueue reset the attempts', async () => {
    const database = await createTestDatabase()
    const member = await insertMember(database)
    const product = await insertProduct(database, member.id)
    await insertStockItem(database, member.id, product.id, 'in-stock')
    await database.insert(priceRefreshRequests).values({ productId: product.id, requestedAt: null, attempts: 3 })

    await enqueueHeldProducts(database, now)

    const [row] = await database.select().from(priceRefreshRequests)
    expect(row!.attempts).toBe(0)
    expect(row!.requestedAt).toEqual(now)
  })
})
