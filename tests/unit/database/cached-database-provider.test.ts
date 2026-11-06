import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createCachedDatabaseProvider } from '../../../server/database/cached-database-provider.ts'

const fakeDatabase = {} as KairosDatabase

describe('createCachedDatabaseProvider', () => {
  it('opens the database once and shares it', async () => {
    const opener = vi.fn(async () => fakeDatabase)
    const provideDatabase = createCachedDatabaseProvider(opener)

    const firstDatabase = await provideDatabase()
    const secondDatabase = await provideDatabase()

    expect(firstDatabase).toBe(fakeDatabase)
    expect(secondDatabase).toBe(fakeDatabase)
    expect(opener).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed opening and retries on the next call', async () => {
    const opener = vi.fn()
      .mockRejectedValueOnce(new Error('database unreachable'))
      .mockResolvedValueOnce(fakeDatabase)
    const provideDatabase = createCachedDatabaseProvider(opener)

    await expect(provideDatabase()).rejects.toThrow('database unreachable')
    const database = await provideDatabase()

    expect(database).toBe(fakeDatabase)
    expect(opener).toHaveBeenCalledTimes(2)
  })
})
