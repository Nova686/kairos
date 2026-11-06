import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'
import { seedAccounts } from '../support/end-to-end-accounts.ts'

const memberEmail = 'member@example.com'
const memberPassword = 'member-password-123'

const attemptLogin = (email: string, password: string, forgedForwardedFor: string) =>
  fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': forgedForwardedFor },
  })

describe('login rate limiting without the deploy proxy', async () => {
  const previousProxyTrust = process.env.NUXT_TRUST_PROXY_HEADERS
  process.env.NUXT_TRUST_PROXY_HEADERS = 'false'
  const databaseUrl = await seedAccounts([
    { email: memberEmail, displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)
  afterAll(() => {
    if (previousProxyTrust === undefined) delete process.env.NUXT_TRUST_PROXY_HEADERS
    else process.env.NUXT_TRUST_PROXY_HEADERS = previousProxyTrust
  })

  it('keys failed logins on the socket address so a forged X-Forwarded-For cannot dodge the limit', async () => {
    for (let attemptNumber = 1; attemptNumber <= 10; attemptNumber += 1) {
      const failedAttempt = await attemptLogin(`guess-${attemptNumber}@example.com`, 'not-the-password', `203.0.113.${attemptNumber}`)
      expect(failedAttempt.status).toBe(401)
    }

    const attemptWithAnotherForgedAddress = await attemptLogin(memberEmail, memberPassword, '198.51.100.77')

    expect(attemptWithAnotherForgedAddress.status).toBe(429)
  })
})
