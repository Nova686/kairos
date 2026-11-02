import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const firstPassword = 'first-user-password'
const secondPassword = 'second-user-password'

const sendJson = (path: string, method: string, cookie: string, body?: unknown) =>
  fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('sales API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'first@example.com', displayName: 'First', password: firstPassword, isAdmin: false },
    { email: 'second@example.com', displayName: 'Second', password: secondPassword, isAdmin: false },
  ])
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

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/sales')).status).toBe(401)
  })

  it('sells, delivers and deletes a sale while keeping it private to its owner', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Écarlate', category: 'pokemon-sealed' },
      headers: { cookie: firstCookie },
    })
    const purchase = await $fetch<{ stockItems: { id: string }[] }>('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: '2026-11-02',
        totalPriceCents: 4000,
        lines: [
          { productId: product.id, condition: 'sealed-new', allocatedPurchaseCents: 3000 },
          { productId: product.id, condition: 'sealed-new', allocatedPurchaseCents: 1000 },
        ],
      },
      headers: { cookie: firstCookie },
    })
    const stockItemIds = purchase.stockItems.map(stockItem => stockItem.id)
    const saleBody = {
      soldOn: '2026-11-03',
      platform: 'Vinted',
      totalPriceCents: 9500,
      shippingIncluded: true,
      shippingCostCents: 600,
      platformFeesCents: 800,
      packagingCostCents: 100,
      trackingReference: 'LP123',
      stockItemIds,
    }

    const invalidBody = await sendJson('/api/sales', 'POST', firstCookie, { soldOn: 'nope' })
    const foreignCreate = await sendJson('/api/sales', 'POST', secondCookie, saleBody)
    const created = await $fetch<{ sale: { id: string } }>('/api/sales', {
      method: 'POST',
      body: saleBody,
      headers: { cookie: firstCookie },
    })
    const soldAgain = await sendJson('/api/sales', 'POST', firstCookie, saleBody)
    const foreignDelivered = await sendJson(`/api/sales/${created.sale.id}/delivered`, 'POST', secondCookie, {
      deliveredOn: '2026-11-05',
    })
    const delivered = await $fetch<{ deliveredOn: string }>(`/api/sales/${created.sale.id}/delivered`, {
      method: 'POST',
      body: { deliveredOn: '2026-11-05' },
      headers: { cookie: firstCookie },
    })
    const ownSales = await $fetch<{ saleNetCents: number, netProfitCents: number }[]>('/api/sales', {
      headers: { cookie: firstCookie },
    })
    const foreignSales = await $fetch<unknown[]>('/api/sales', { headers: { cookie: secondCookie } })
    const foreignDelete = await sendJson(`/api/sales/${created.sale.id}`, 'DELETE', secondCookie)
    const ownDelete = await sendJson(`/api/sales/${created.sale.id}`, 'DELETE', firstCookie)
    const restockedItems = await $fetch<{ status: string }[]>('/api/stock-items?status=in-stock', {
      headers: { cookie: firstCookie },
    })

    expect(invalidBody.status).toBe(422)
    expect(foreignCreate.status).toBe(404)
    expect(soldAgain.status).toBe(409)
    expect(foreignDelivered.status).toBe(404)
    expect(delivered.deliveredOn).toBe('2026-11-05')
    expect(ownSales).toHaveLength(1)
    expect(ownSales[0]!.saleNetCents).toBe(8000)
    expect(ownSales[0]!.netProfitCents).toBe(4000)
    expect(foreignSales).toEqual([])
    expect(foreignDelete.status).toBe(404)
    expect(ownDelete.status).toBe(204)
    expect(restockedItems).toHaveLength(2)
  })
})
