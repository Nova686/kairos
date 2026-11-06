import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { describeDatabaseConflict } from '../../../server/database/database-conflict.ts'
import { locations, persons, users } from '../../../server/database/schema/index.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const captureFailure = async (action: () => Promise<unknown>): Promise<unknown> => {
  try {
    await action()
  } catch (failure) {
    return failure
  }
  throw new Error('The action was expected to fail')
}

const insertOwner = async (database: Awaited<ReturnType<typeof createTestDatabase>>) => {
  const [owner] = await database.insert(users).values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' }).returning()
  return owner!.id
}

describe('describeDatabaseConflict', () => {
  it('names a duplicate location label raised by the database, also once wrapped by the HTTP layer', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database)
    await database.insert(locations).values({ ownerId, label: 'Étagère' })

    const failure = await captureFailure(() => database.insert(locations).values({ ownerId, label: 'Étagère' }))

    expect(describeDatabaseConflict(failure)).toBe('Un emplacement porte déjà ce nom')
    expect(describeDatabaseConflict(createError(failure as Error))).toBe('Un emplacement porte déjà ce nom')
  })

  it('answers a generic message for a row still referenced or a reference that vanished', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database)
    await database.insert(persons).values({ ownerId, name: 'Camille' })

    const stillReferenced = await captureFailure(() => database.delete(users).where(eq(users.id, ownerId)))
    const vanishedReference = await captureFailure(() =>
      database.insert(persons).values({ ownerId: '00000000-0000-4000-8000-000000000000', name: 'Alex' }))

    expect(describeDatabaseConflict(stillReferenced)).toBe('Une donnée liée vient de changer : rechargez la page')
    expect(describeDatabaseConflict(vanishedReference)).toBe('Une donnée liée vient de changer : rechargez la page')
  })

  it('reads the constraint name of the postgres driver errors', () => {
    const postgresDriverFailure = { code: '23505', constraint_name: 'users_email_unique' }

    expect(describeDatabaseConflict(new Error('Failed query', { cause: postgresDriverFailure }))).toBe('Cet email est déjà utilisé')
    expect(describeDatabaseConflict({ code: '23505', constraint_name: 'some_new_unique' }))
      .toBe('Cette donnée existe déjà : rechargez la page')
  })

  it('ignores failures that are not uniqueness or reference conflicts', async () => {
    const database = await createTestDatabase()

    const invalidIdentifier = await captureFailure(() => database.select().from(locations).where(eq(locations.id, 'not-a-uuid')))

    expect(describeDatabaseConflict(invalidIdentifier)).toBeNull()
    expect(describeDatabaseConflict(new Error('boom'))).toBeNull()
    expect(describeDatabaseConflict(createError({ statusCode: 404 }))).toBeNull()
    expect(describeDatabaseConflict(null)).toBeNull()
  })
})
