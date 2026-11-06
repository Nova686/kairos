import { createCachedDatabaseProvider } from '../database/cached-database-provider'
import { openDatabase } from '../database/open-database'

export const useDatabase = createCachedDatabaseProvider(() => openDatabase(useRuntimeConfig().databaseUrl))
