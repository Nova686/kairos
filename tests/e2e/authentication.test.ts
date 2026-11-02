import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { openDatabase } from '../../server/database/open-database.ts'
import { createUser } from '../../server/domain/accounts/accounts-service.ts'
import { scryptPasswordHasher } from '../../server/domain/accounts/scrypt-password-hasher.ts'

const administratorEmail = 'admin@example.com'
const administratorPassword = 'administrator-password'

const seedAdministrator = async (): Promise<string> => {
  const databaseUrl = `pglite://${join(mkdtempSync(join(tmpdir(), 'kairos-e2e-')), 'database')}`
  const database = await openDatabase(databaseUrl)
  await createUser(
    database,
    { email: administratorEmail, displayName: 'Admin', password: administratorPassword, isAdmin: true },
    scryptPasswordHasher,
  )
  await (database as unknown as { $client: { close: () => Promise<void> } }).$client.close()
  return databaseUrl
}

const extractSessionCookie = (response: Response): string =>
  (response.headers.getSetCookie()[0] ?? '').split(';')[0] ?? ''

describe('authentication', async () => {
  const databaseUrl = await seedAdministrator()
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    nuxtConfig: {
      runtimeConfig: {
        databaseUrl,
        appSecret: 'kairos-end-to-end-app-secret-1234567890',
      },
    },
  })

  it('answers 401 on the current user without a session', async () => {
    const response = await fetch('/api/auth/me')

    expect(response.status).toBe(401)
  })

  it('answers 401 on a wrong password', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: administratorEmail, password: 'not-the-password' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.status).toBe(401)
  })

  it('logs in then returns the user on the current user endpoint', async () => {
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ADMIN@example.com', password: administratorPassword }),
      headers: { 'content-type': 'application/json' },
    })
    const sessionCookie = extractSessionCookie(loginResponse)

    const currentUser = await $fetch<{ email: string, isAdmin: boolean }>('/api/auth/me', {
      headers: { cookie: sessionCookie },
    })

    expect(loginResponse.status).toBe(200)
    expect(currentUser).toMatchObject({ email: administratorEmail, isAdmin: true })
  })

  it('answers 401 on the current user after signing out through the library session route', async () => {
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: administratorEmail, password: administratorPassword }),
      headers: { 'content-type': 'application/json' },
    })
    const signOutResponse = await fetch('/api/_auth/session', {
      method: 'DELETE',
      headers: { cookie: extractSessionCookie(loginResponse) },
    })

    const currentUserResponse = await fetch('/api/auth/me', {
      headers: { cookie: extractSessionCookie(signOutResponse) },
    })

    expect(signOutResponse.status).toBe(200)
    expect(currentUserResponse.status).toBe(401)
  })

  it('does not answer 401 on the library session route for an anonymous visitor', async () => {
    const response = await fetch('/api/_auth/session')

    expect(response.status).not.toBe(401)
  })

  it('lets an administrator invite someone who then accepts and signs in', async () => {
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: administratorEmail, password: administratorPassword }),
      headers: { 'content-type': 'application/json' },
    })
    const administratorCookie = extractSessionCookie(loginResponse)

    const { code } = await $fetch<{ code: string }>('/api/invitations', {
      method: 'POST',
      headers: { cookie: administratorCookie },
    })
    const lookupResponse = await fetch(`/api/invitations/${code}`)
    const acceptResponse = await fetch(`/api/invitations/${code}/accept`, {
      method: 'POST',
      body: JSON.stringify({ email: 'guest@example.com', displayName: 'Guest', password: 'guest-password-1' }),
      headers: { 'content-type': 'application/json' },
    })
    const secondLookupResponse = await fetch(`/api/invitations/${code}`)
    const guestInvitationAttempt = await fetch('/api/invitations', {
      method: 'POST',
      headers: { cookie: extractSessionCookie(acceptResponse) },
    })

    expect(lookupResponse.status).toBe(200)
    expect(acceptResponse.status).toBe(200)
    expect(secondLookupResponse.status).toBe(410)
    expect(guestInvitationAttempt.status).toBe(403)
  })
})
