import { openDatabase, type KairosDatabase } from '../database/open-database'

let databasePromise: Promise<KairosDatabase> | undefined

export const useDatabase = (): Promise<KairosDatabase> => {
  databasePromise ??= openDatabase(useRuntimeConfig().databaseUrl)
  return databasePromise
}
