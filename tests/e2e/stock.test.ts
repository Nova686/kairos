import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const firstPassword = 'first-user-password'
const secondPassword = 'second-user-password'

const sendJson = (path: string, method: string, cookie: string, body?: unknown) =>
  fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('purchases and stock items API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'first@example.com', displayName: 'First', password: firstPassword, isAdmin: false },
    { email: 'second@example.com', displayName: 'Second', password: secondPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/purchases')).status).toBe(401)
    expect((await fetch('/api/stock-items')).status).toBe(401)
  })

  it('creates a purchase, receives its item and keeps it private to its owner', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Écarlate', category: 'pokemon-sealed' },
      headers: { cookie: firstCookie },
    })

    const created = await $fetch<{ purchase: { id: string }, stockItems: { id: string, status: string }[] }>(
      '/api/purchases',
      {
        method: 'POST',
        body: {
          purchasedOn: '2026-11-02',
          totalPriceCents: 10000,
          feesCents: 450,
          inTransit: true,
          lines: [{ productId: product.id, condition: 'sealed-new' }],
        },
        headers: { cookie: firstCookie },
      },
    )
    const stockItemId = created.stockItems[0]!.id

    const invalidBody = await sendJson('/api/purchases', 'POST', firstCookie, { purchasedOn: 'nope' })
    const foreignGet = await sendJson(`/api/stock-items/${stockItemId}`, 'GET', secondCookie)
    const foreignPatch = await sendJson(`/api/stock-items/${stockItemId}`, 'PATCH', secondCookie, { notes: 'x' })
    const foreignReceive = await sendJson(`/api/stock-items/${stockItemId}/receive`, 'POST', secondCookie, {
      receivedOn: '2026-11-05',
    })
    const foreignDelete = await sendJson(`/api/purchases/${created.purchase.id}`, 'DELETE', secondCookie)
    const received = await $fetch<{ status: string }>(`/api/stock-items/${stockItemId}/receive`, {
      method: 'POST',
      body: { receivedOn: '2026-11-05' },
      headers: { cookie: firstCookie },
    })
    const receivedAgain = await sendJson(`/api/stock-items/${stockItemId}/receive`, 'POST', firstCookie, {
      receivedOn: '2026-11-06',
    })
    const ownStockItems = await $fetch<unknown[]>('/api/stock-items?status=in-stock&search=ecarlate', {
      headers: { cookie: firstCookie },
    })
    const foreignStockItems = await $fetch<unknown[]>('/api/stock-items', { headers: { cookie: secondCookie } })

    expect(created.stockItems[0]!.status).toBe('in-transit')
    expect(invalidBody.status).toBe(422)
    expect(foreignGet.status).toBe(404)
    expect(foreignPatch.status).toBe(404)
    expect(foreignReceive.status).toBe(404)
    expect(foreignDelete.status).toBe(404)
    expect(received.status).toBe('in-stock')
    expect(receivedAgain.status).toBe(409)
    expect(ownStockItems).toHaveLength(1)
    expect(foreignStockItems).toEqual([])
  })

  it('keeps the purchase listed when another user tries to delete it', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Cross', category: 'pokemon-sealed' },
      headers: { cookie: firstCookie },
    })
    const created = await $fetch<{ purchase: { id: string } }>('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: '2026-11-02',
        totalPriceCents: 5000,
        lines: [{ productId: product.id, condition: 'sealed-new' }],
      },
      headers: { cookie: firstCookie },
    })

    const foreignDelete = await sendJson(`/api/purchases/${created.purchase.id}`, 'DELETE', secondCookie)

    const firstUserPurchases = await $fetch<{ id: string }[]>('/api/purchases', { headers: { cookie: firstCookie } })
    expect(foreignDelete.status).toBe(404)
    expect(firstUserPurchases.map(purchase => purchase.id)).toContain(created.purchase.id)
  })

  it('answers 422 on an impossible calendar date, an oversized amount and a malformed location filter', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Validation', category: 'pokemon-sealed' },
      headers: { cookie: firstCookie },
    })
    const line = { productId: product.id, condition: 'sealed-new' }

    const impossibleDate = await sendJson('/api/purchases', 'POST', firstCookie, {
      purchasedOn: '2026-02-30',
      totalPriceCents: 1000,
      lines: [line],
    })
    const oversizedAmount = await sendJson('/api/purchases', 'POST', firstCookie, {
      purchasedOn: '2026-11-02',
      totalPriceCents: 2_147_483_648,
      lines: [line],
    })
    const malformedLocation = await sendJson('/api/stock-items?locationId=not-a-uuid', 'GET', firstCookie)

    expect(impossibleDate.status).toBe(422)
    expect(oversizedAmount.status).toBe(422)
    expect(malformedLocation.status).toBe(422)
  })
})
