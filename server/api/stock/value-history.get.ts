import { and, asc, eq, gte } from 'drizzle-orm'
import { stockValueSnapshots } from '../../database/schema'
import { parisCalendarDateOf } from '../../domain/prices/start-of-paris-day'

const historyWindowMilliseconds = 365 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const earliestDay = parisCalendarDateOf(new Date(Date.now() - historyWindowMilliseconds))
  return (await useDatabase())
    .select()
    .from(stockValueSnapshots)
    .where(and(eq(stockValueSnapshots.ownerId, sessionUser.id), gte(stockValueSnapshots.snapshotOn, earliestDay)))
    .orderBy(asc(stockValueSnapshots.snapshotOn))
})
