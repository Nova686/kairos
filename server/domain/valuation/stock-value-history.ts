import { and, asc, eq, gte } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { stockValueSnapshots } from '../../database/schema/index.ts'
import { parisCalendarDateOf } from '../prices/start-of-paris-day.ts'

const historyWindowMilliseconds = 365 * 24 * 60 * 60 * 1000

export type StockValueSnapshot = typeof stockValueSnapshots.$inferSelect

export const listStockValueHistory = (database: KairosDatabase, ownerId: string, now: Date): Promise<StockValueSnapshot[]> => {
  const earliestDay = parisCalendarDateOf(new Date(now.getTime() - historyWindowMilliseconds))
  return database
    .select()
    .from(stockValueSnapshots)
    .where(and(eq(stockValueSnapshots.ownerId, ownerId), gte(stockValueSnapshots.snapshotOn, earliestDay)))
    .orderBy(asc(stockValueSnapshots.snapshotOn))
}
