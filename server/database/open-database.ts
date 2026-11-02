import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema/index.ts'

export type KairosDatabase = PgDatabase<PgQueryResultHKT, typeof schema>

const pgliteUrlPrefix = 'pglite://'
const inMemoryTarget = 'memory'
const migrationsFolder = resolve(process.cwd(), 'server/database/migrations')

const openPgliteDatabase = async (target: string): Promise<KairosDatabase> => {
  const isInMemory = target === inMemoryTarget
  if (!isInMemory) {
    mkdirSync(resolve(target, '..'), { recursive: true })
  }
  const pglite = new PGlite(isInMemory ? undefined : target)
  const database = drizzlePglite(pglite, { schema })
  await migratePglite(database, { migrationsFolder })
  return database as unknown as KairosDatabase
}

const openPostgresDatabase = async (databaseUrl: string): Promise<KairosDatabase> => {
  const database = drizzlePostgres(postgres(databaseUrl), { schema })
  await migratePostgres(database, { migrationsFolder })
  return database as unknown as KairosDatabase
}

export const openDatabase = async (databaseUrl: string): Promise<KairosDatabase> =>
  databaseUrl.startsWith(pgliteUrlPrefix)
    ? openPgliteDatabase(databaseUrl.slice(pgliteUrlPrefix.length))
    : openPostgresDatabase(databaseUrl)
