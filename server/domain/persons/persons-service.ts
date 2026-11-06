import { and, asc, eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { debts, persons, sales } from '../../database/schema/index.ts'
import { findOwnedOr404 } from '../ownership/find-owned-or-404.ts'

export type Person = typeof persons.$inferSelect

export class PersonNameInvalidError extends Error {
  constructor() {
    super('Person name must not be empty')
    this.name = 'PersonNameInvalidError'
  }
}

export class PersonInUseError extends Error {
  constructor() {
    super('Person is referenced by a debt or a sale')
    this.name = 'PersonInUseError'
  }
}

const normalizeName = (name: string): string => {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    throw new PersonNameInvalidError()
  }
  return trimmedName
}

export const listPersons = (database: KairosDatabase, ownerId: string): Promise<Person[]> =>
  database.select().from(persons).where(eq(persons.ownerId, ownerId)).orderBy(asc(persons.name))

export const createPerson = async (database: KairosDatabase, ownerId: string, name: string): Promise<Person> => {
  const [createdPerson] = await database.insert(persons).values({ ownerId, name: normalizeName(name) }).returning()
  return createdPerson!
}

export const renamePerson = async (
  database: KairosDatabase,
  ownerId: string,
  personId: string,
  name: string,
): Promise<Person> => {
  await findOwnedOr404(database, persons, personId, ownerId)
  const [renamedPerson] = await database
    .update(persons)
    .set({ name: normalizeName(name) })
    .where(and(eq(persons.id, personId), eq(persons.ownerId, ownerId)))
    .returning()
  return renamedPerson!
}

export const deletePerson = async (database: KairosDatabase, ownerId: string, personId: string): Promise<void> => {
  await findOwnedOr404(database, persons, personId, ownerId)
  const [referencingDebt] = await database
    .select({ id: debts.id })
    .from(debts)
    .where(eq(debts.personId, personId))
    .limit(1)
  const [referencingSale] = await database
    .select({ id: sales.id })
    .from(sales)
    .where(eq(sales.buyerPersonId, personId))
    .limit(1)
  if (referencingDebt || referencingSale) {
    throw new PersonInUseError()
  }
  await database.delete(persons).where(and(eq(persons.id, personId), eq(persons.ownerId, ownerId)))
}
