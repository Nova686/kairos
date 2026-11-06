import { inArray } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { priceRefreshRequests } from '../../database/schema/index.ts'

const ebaySource = 'ebay'

export const loadLastEbayRefreshes = async (
  database: KairosDatabase,
  productIds: string[],
): Promise<Map<string, Date>> => {
  if (productIds.length === 0) {
    return new Map()
  }
  const rows = await database
    .select({ productId: priceRefreshRequests.productId, lastEbayRefreshAt: priceRefreshRequests.lastEbayRefreshAt })
    .from(priceRefreshRequests)
    .where(inArray(priceRefreshRequests.productId, productIds))
  return new Map(rows
    .filter((row): row is { productId: string; lastEbayRefreshAt: Date } => row.lastEbayRefreshAt !== null)
    .map(row => [row.productId, row.lastEbayRefreshAt]))
}

export const isSupersededEbaySnapshot = (
  snapshot: { source: string; observedAt: Date },
  lastEbayRefreshAt: Date | undefined,
): boolean =>
  snapshot.source === ebaySource
  && lastEbayRefreshAt !== undefined
  && snapshot.observedAt.getTime() < lastEbayRefreshAt.getTime()
