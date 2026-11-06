import { sql } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'

export interface HealthReport {
  status: 'ok' | 'degraded'
}

export const unreachableDatabaseHealthReport = (): HealthReport => ({ status: 'degraded' })

export const checkHealth = async (database: KairosDatabase): Promise<HealthReport> => {
  const isDatabaseAnswering = await database.execute(sql`select 1`).then(
    () => true,
    () => false,
  )
  return isDatabaseAnswering ? { status: 'ok' } : unreachableDatabaseHealthReport()
}
