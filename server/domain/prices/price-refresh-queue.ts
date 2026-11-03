import { and, asc, eq, gte, inArray, isNotNull, notExists, or, sql } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { priceRefreshRequests, stockItems } from '../../database/schema/index.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { loadRefreshRulesContext, refreshProductPrices } from './refresh-product-prices.ts'
import type { PriceSourceGateway, RefreshOutcome, RefreshRulesContext } from './refresh-product-prices.ts'
import { startOfParisDay } from './start-of-paris-day.ts'

const heldStatuses = ['in-transit', 'in-stock']
const manualRefreshMinimumIntervalMilliseconds = 10 * 60_000
const defaultBatchSize = 20
const maximumDailyAttempts = 3

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
  if (productIds.length > 0) {
    await database
      .update(priceRefreshRequests)
      .set({ attempts: 0 })
      .where(inArray(priceRefreshRequests.productId, productIds))
  }
  return productIds.length
}

export const enqueueUserHeldProducts = async (
  database: KairosDatabase,
  userId: string,
  now: Date,
): Promise<number> => {
  const refreshedTodayOrQueued = database
    .select({ productId: priceRefreshRequests.productId })
    .from(priceRefreshRequests)
    .where(and(
      eq(priceRefreshRequests.productId, stockItems.productId),
      or(
        gte(priceRefreshRequests.lastRefreshedAt, startOfParisDay(now)),
        isNotNull(priceRefreshRequests.requestedAt),
      ),
    ))
  const heldProducts = await database
    .selectDistinct({ productId: stockItems.productId })
    .from(stockItems)
    .where(and(
      eq(stockItems.ownerId, userId),
      inArray(stockItems.status, heldStatuses),
      notExists(refreshedTodayOrQueued),
    ))
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

const releaseManualRefreshClaim = async (
  database: KairosDatabase,
  productId: string,
  claimedAt: Date,
  previousRefreshAt: Date | null,
): Promise<void> => {
  await database
    .update(priceRefreshRequests)
    .set({ lastRefreshedAt: previousRefreshAt })
    .where(and(eq(priceRefreshRequests.productId, productId), eq(priceRefreshRequests.lastRefreshedAt, claimedAt)))
}

export const refreshProductNow = async (
  database: KairosDatabase,
  gateway: PriceSourceGateway,
  productId: string,
  userId: string,
  now: Date,
): Promise<RefreshOutcome> => {
  await findProductOr404(database, productId)
  const [previousRequest] = await database
    .select({ lastRefreshedAt: priceRefreshRequests.lastRefreshedAt })
    .from(priceRefreshRequests)
    .where(eq(priceRefreshRequests.productId, productId))
  const previousRefreshAt = previousRequest?.lastRefreshedAt ?? null
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
    const [currentRequest] = await database
      .select({ lastRefreshedAt: priceRefreshRequests.lastRefreshedAt })
      .from(priceRefreshRequests)
      .where(eq(priceRefreshRequests.productId, productId))
    const lastRefreshedAt = currentRequest?.lastRefreshedAt ?? now
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lastRefreshedAt.getTime() + manualRefreshMinimumIntervalMilliseconds - now.getTime()) / 1000),
    )
    throw createError({
      statusCode: 429,
      statusMessage: 'déjà relevé il y a moins de 10 minutes',
      data: { retryAfterSeconds, remainingMinutes: Math.ceil(retryAfterSeconds / 60) },
    })
  }
  try {
    return await refreshProductPrices(database, gateway, productId, now)
  }
  catch (error) {
    await releaseManualRefreshClaim(database, productId, now, previousRefreshAt)
    throw error
  }
}

export type ProcessQueueOutcome = { refreshedProductCount: number; failedProductCount: number }

type RefreshProduct = (
  database: KairosDatabase,
  gateway: PriceSourceGateway,
  productId: string,
  now: Date,
  rulesContext?: RefreshRulesContext,
) => Promise<RefreshOutcome>

const recordFailedRefresh = async (database: KairosDatabase, productId: string, now: Date): Promise<void> => {
  await database
    .update(priceRefreshRequests)
    .set({
      attempts: sql`${priceRefreshRequests.attempts} + 1`,
      requestedAt: sql`case when ${priceRefreshRequests.attempts} + 1 < ${maximumDailyAttempts} then ${now.toISOString()}::timestamptz else null end`,
    })
    .where(eq(priceRefreshRequests.productId, productId))
}

type QueueLogger = (...details: unknown[]) => void

export type ProcessQueueDependencies = {
  refreshProduct?: RefreshProduct
  logFailure?: QueueLogger
  logUnavailableSources?: QueueLogger
}

export const processRefreshQueue = async (
  database: KairosDatabase,
  gateway: PriceSourceGateway,
  now: Date,
  {
    refreshProduct = refreshProductPrices,
    logFailure = console.error,
    logUnavailableSources = console.warn,
  }: ProcessQueueDependencies = {},
): Promise<ProcessQueueOutcome> => {
  const productIds = await takeNextRefreshBatch(database)
  if (productIds.length === 0) {
    return { refreshedProductCount: 0, failedProductCount: 0 }
  }
  const rulesContext = await loadRefreshRulesContext(database)
  let refreshedProductCount = 0
  let failedProductCount = 0
  for (const productId of productIds) {
    try {
      const { unavailableSources } = await refreshProduct(database, gateway, productId, now, rulesContext)
      if (unavailableSources.length > 0) {
        logUnavailableSources('Price sources unavailable', productId, unavailableSources)
      }
      refreshedProductCount += 1
    }
    catch (error) {
      failedProductCount += 1
      logFailure('Price refresh failed', productId, error)
      await recordFailedRefresh(database, productId, now)
    }
  }
  return { refreshedProductCount, failedProductCount }
}
