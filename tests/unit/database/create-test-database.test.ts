import { describe, expect, it } from 'vitest'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { titleConditionRules, users } from '../../../server/database/schema/index.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

type ClosableClient = { closed: boolean }

const clientOf = (database: KairosDatabase): ClosableClient =>
  (database as unknown as { $client: ClosableClient }).$client

describe('createTestDatabase', () => {
  let databaseOfPreviousTest: KairosDatabase | null = null

  it('opens a migrated and seeded database', async () => {
    const database = await createTestDatabase()
    databaseOfPreviousTest = database
    await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' })

    expect(await database.select().from(titleConditionRules)).toHaveLength(3)
    expect(clientOf(database).closed).toBe(false)
  })

  it('closes the database of the previous test and starts from a clean copy', async () => {
    const database = await createTestDatabase()

    expect(clientOf(databaseOfPreviousTest!).closed).toBe(true)
    expect(await database.select().from(users)).toEqual([])
    expect(await database.select().from(titleConditionRules)).toHaveLength(3)
  })

  it('gives independent databases within one test', async () => {
    const firstDatabase = await createTestDatabase()
    const secondDatabase = await createTestDatabase()
    await firstDatabase.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' })

    expect(await secondDatabase.select().from(users)).toEqual([])
  })
})
