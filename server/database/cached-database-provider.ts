import type { KairosDatabase } from './open-database.ts'

export const createCachedDatabaseProvider = (
  openDatabaseConnection: () => Promise<KairosDatabase>,
): (() => Promise<KairosDatabase>) => {
  let databasePromise: Promise<KairosDatabase> | undefined
  return () => {
    if (databasePromise === undefined) {
      const openingPromise = openDatabaseConnection()
      databasePromise = openingPromise
      openingPromise.catch(() => {
        if (databasePromise === openingPromise) {
          databasePromise = undefined
        }
      })
    }
    return databasePromise
  }
}
