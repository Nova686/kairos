import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-123'

const postWithCookie = (path: string, cookie: string) =>
  fetch(path, { method: 'POST', headers: { cookie } })

describe('price refresh API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/stock/refresh-prices', { method: 'POST' })).status).toBe(401)
    expect((await fetch('/api/products/00000000-0000-4000-8000-000000000000/refresh-prices', { method: 'POST' })).status).toBe(401)
  })

  it('queues zero products for a member holding nothing', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const response = await postWithCookie('/api/stock/refresh-prices', cookie)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ queuedProductCount: 0 })
  })

  it('answers 404 for an unknown product', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const response = await postWithCookie('/api/products/00000000-0000-4000-8000-000000000000/refresh-prices', cookie)
    expect(response.status).toBe(404)
  })
})
