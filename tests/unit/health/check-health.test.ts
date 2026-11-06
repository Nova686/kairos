import { checkHealth } from '../../../server/domain/health/check-health.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

describe('checkHealth', () => {
  it('reports ok when the database answers', async () => {
    const database = await createTestDatabase()

    const report = await checkHealth(database)

    expect(report).toEqual({ status: 'ok' })
  })

  it('reports degraded when the database throws', async () => {
    const unreachableDatabase = {
      execute: async () => {
        throw new Error('connection refused: postgres://secret@host')
      },
    } as unknown as KairosDatabase

    const report = await checkHealth(unreachableDatabase)

    expect(report).toEqual({ status: 'degraded' })
    expect(JSON.stringify(report)).not.toContain('secret')
  })
})
