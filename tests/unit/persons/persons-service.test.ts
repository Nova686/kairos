import { debts, sales, users } from '../../../server/database/schema/index.ts'
import {
  PersonInUseError,
  PersonNameInvalidError,
  createPerson,
  deletePerson,
  listPersons,
  renamePerson,
} from '../../../server/domain/persons/persons-service.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

describe('persons service', () => {
  it('creates a person with a trimmed name and lists it for its owner only', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')

    await createPerson(database, ownerId, '  Camille  ')

    expect((await listPersons(database, ownerId)).map(person => person.name)).toEqual(['Camille'])
    expect(await listPersons(database, otherOwnerId)).toEqual([])
  })

  it('rejects an empty name', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')

    await expect(createPerson(database, ownerId, ' ')).rejects.toBeInstanceOf(PersonNameInvalidError)
  })

  it('renames a person and answers 404 for another owner', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const camille = await createPerson(database, ownerId, 'Camille')

    const renamedPerson = await renamePerson(database, ownerId, camille.id, 'Camille D.')

    expect(renamedPerson.name).toBe('Camille D.')
    await expect(renamePerson(database, otherOwnerId, camille.id, 'Volée')).rejects.toMatchObject({ statusCode: 404 })
    await expect(deletePerson(database, otherOwnerId, camille.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses to delete a person referenced by a debt', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const camille = await createPerson(database, ownerId, 'Camille')
    await database.insert(debts).values({
      ownerId,
      personId: camille.id,
      amountCents: 500,
      direction: 'owed-to-me',
      reason: 'Prêt',
      createdOn: '2026-11-02',
    })

    await expect(deletePerson(database, ownerId, camille.id)).rejects.toBeInstanceOf(PersonInUseError)
  })

  it('refuses to delete a person who bought a sale', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const camille = await createPerson(database, ownerId, 'Camille')
    await database.insert(sales).values({
      ownerId,
      soldOn: '2026-11-02',
      platform: 'main-propre',
      buyerPersonId: camille.id,
      totalPriceCents: 2000,
      shippingIncluded: false,
    })

    await expect(deletePerson(database, ownerId, camille.id)).rejects.toBeInstanceOf(PersonInUseError)
  })

  it('deletes an unreferenced person', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const camille = await createPerson(database, ownerId, 'Camille')

    await deletePerson(database, ownerId, camille.id)

    expect(await listPersons(database, ownerId)).toEqual([])
  })
})
