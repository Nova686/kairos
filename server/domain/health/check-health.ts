import { sql } from 'drizzle-orm'
import packageManifest from '../../../package.json' with { type: 'json' }
import type { KairosDatabase } from '../../database/open-database.ts'

export interface HealthReport {
  status: 'ok' | 'degraded'
  database: 'ok' | 'down'
  version: string
}

export const unreachableDatabaseHealthReport = (): HealthReport => ({
  status: 'degraded',
  database: 'down',
  version: packageManifest.version,
})

export const checkHealth = async (database: KairosDatabase): Promise<HealthReport> => {
  const isDatabaseAnswering = await database.execute(sql`select 1`).then(
    () => true,
    () => false,
  )
  return isDatabaseAnswering
    ? { status: 'ok', database: 'ok', version: packageManifest.version }
    : unreachableDatabaseHealthReport()
}
