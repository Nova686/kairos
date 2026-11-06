import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetch } from './end-to-end-server.ts'
import { openDatabase } from '../../server/database/open-database.ts'
import { createUser } from '../../server/domain/accounts/accounts-service.ts'
import { scryptPasswordHasher } from '../../server/domain/accounts/scrypt-password-hasher.ts'

export type SeededAccount = {
  email: string
  displayName: string
  password: string
  isAdmin: boolean
}

export const seedAccounts = async (accounts: SeededAccount[]): Promise<string> => {
  const databaseUrl = `pglite://${join(mkdtempSync(join(tmpdir(), 'kairos-e2e-')), 'database')}`
  const database = await openDatabase(databaseUrl)
  for (const account of accounts) {
    await createUser(database, account, scryptPasswordHasher)
  }
  await (database as unknown as { $client: { close: () => Promise<void> } }).$client.close()
  return databaseUrl
}

export const extractSessionCookie = (response: Response): string =>
  (response.headers.getSetCookie()[0] ?? '').split(';')[0] ?? ''

export const logIn = async (email: string, password: string): Promise<string> => {
  const loginResponse = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
  })
  return extractSessionCookie(loginResponse)
}
