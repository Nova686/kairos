import { openDatabase, type KairosDatabase } from '../../server/database/open-database.ts'

export const createTestDatabase = (): Promise<KairosDatabase> => openDatabase('pglite://memory')
