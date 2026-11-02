import { and, asc, eq, gte, inArray, isNotNull, notExists, sql } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { priceRefreshRequests, stockItems } from '../../database/schema/index.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { refreshProductPrices } from './refresh-product-prices.ts'
import type { PriceSourceGateway, RefreshOutcome } from './refresh-product-prices.ts'
import { startOfParisDay } from './start-of-paris-day.ts'

const heldStatuses = ['in-transit', 'in-stock']
const manualRefreshMinimumIntervalMilliseconds = 10 * 60_000
const defaultBatchSize = 20

export const enqueueProducts = async (
  database: KairosDatabase,
  productIds: string[],
  requestedByUserId: string | null,
  now: Date,
): Promise<void> => {
  if (productIds.length === 0) {
    return
  }
  await database
    .insert(priceRefreshRequests)
    .values(productIds.map(productId => ({ productId, requestedAt: now, requestedByUserId })))
    .onConflictDoUpdate({
      target: priceRefreshRequests.productId,
      set: {
        requestedByUserId: sql`case when ${priceRefreshRequests.requestedAt} is null then excluded.requested_by_user_id else ${priceRefreshRequests.requestedByUserId} end`,
        requestedAt: sql`least(coalesce(${priceRefreshRequests.requestedAt}, excluded.requested_at), excluded.requested_at)`,
      },
    })
}

export const enqueueHeldProducts = async (database: KairosDatabase, now: Date): Promise<number> => {
  const refreshedToday = database
    .select({ productId: priceRefreshRequests.productId })
    .from(priceRefreshRequests)
    .where(and(
      eq(priceRefreshRequests.productId, stockItems.productId),
      gte(priceRefreshRequests.lastRefreshedAt, startOfParisDay(now)),
    ))
  const heldProducts = await database
    .selectDistinct({ productId: stockItems.productId })
    .from(stockItems)
    .where(and(inArray(stockItems.status, heldStatuses), notExists(refreshedToday)))
  const productIds = heldProducts.map(heldProduct => heldProduct.productId)
  await enqueueProducts(database, productIds, null, now)
  return productIds.length
}

export const enqueueUserHeldProducts = async (
  database: KairosDatabase,
  userId: string,
  now: Date,
): Promise<number> => {
  const heldProducts = await database
    .selectDistinct({ productId: stockItems.productId })
    .from(stockItems)
    .where(and(eq(stockItems.ownerId, userId), inArray(stockItems.status, heldStatuses)))
  const productIds = heldProducts.map(heldProduct => heldProduct.productId)
  await enqueueProducts(database, productIds, userId, now)
  return productIds.length
}

export const takeNextRefreshBatch = (
  database: KairosDatabase,
  batchSize: number = defaultBatchSize,
): Promise<string[]> =>
  database.transaction(async (transaction) => {
    const queuedRows = await transaction
      .select({ productId: priceRefreshRequests.productId })
      .from(priceRefreshRequests)
      .where(isNotNull(priceRefreshRequests.requestedAt))
      .orderBy(asc(priceRefreshRequests.requestedAt))
      .limit(batchSize)
      .for('update', { skipLocked: true })
    const productIds = queuedRows.map(queuedRow => queuedRow.productId)
    if (productIds.length > 0) {
      await transaction
        .update(priceRefreshRequests)
        .set({ requestedAt: null })
        .where(inArray(priceRefreshRequests.productId, productIds))
    }
    return productIds
  })

export const refreshProductNow = async (
  database: KairosDatabase,
  gateway: PriceSourceGateway,
  productId: string,
  userId: string,
  now: Date,
): Promise<RefreshOutcome> => {
  await findProductOr404(database, productId)
  const oldestAllowedRefresh = new Date(now.getTime() - manualRefreshMinimumIntervalMilliseconds)
  const claimedRows = await database
    .insert(priceRefreshRequests)
    .values({ productId, requestedAt: null, requestedByUserId: userId, lastRefreshedAt: now })
    .onConflictDoUpdate({
      target: priceRefreshRequests.productId,
      set: { lastRefreshedAt: now },
      setWhere: sql`${priceRefreshRequests.lastRefreshedAt} is null or ${priceRefreshRequests.lastRefreshedAt} <= ${oldestAllowedRefresh.toISOString()}::timestamptz`,
    })
    .returning({ productId: priceRefreshRequests.productId })
  if (claimedRows.length === 0) {
    throw createError({ statusCode: 429, statusMessage: 'déjà relevé il y a moins de 10 minutes' })
  }
  return refreshProductPrices(database, gateway, productId, now)
}
