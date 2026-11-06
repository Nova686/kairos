import { and, eq } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type OwnedTable = PgTable & { id: PgColumn, ownerId: PgColumn }

const selectOwnedRow = (database: KairosDatabase, table: OwnedTable, id: string, ownerId: string) =>
  database
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.ownerId, ownerId)))

const ownedRowOr404 = <TTable extends OwnedTable>(ownedRows: unknown[]): TTable['$inferSelect'] => {
  const [ownedRow] = ownedRows
  if (!ownedRow) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
  return ownedRow as TTable['$inferSelect']
}

export const findOwnedOr404 = async <TTable extends OwnedTable>(
  database: KairosDatabase,
  table: TTable,
  id: string,
  ownerId: string,
): Promise<TTable['$inferSelect']> =>
  ownedRowOr404<TTable>(uuidPattern.test(id) ? await selectOwnedRow(database, table, id, ownerId) : [])

export const lockOwnedOr404 = async <TTable extends OwnedTable>(
  database: KairosDatabase,
  table: TTable,
  id: string,
  ownerId: string,
): Promise<TTable['$inferSelect']> =>
  ownedRowOr404<TTable>(uuidPattern.test(id) ? await selectOwnedRow(database, table, id, ownerId).for('update') : [])
