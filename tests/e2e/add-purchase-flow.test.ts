import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const buyerPassword = 'buyer-user-password'

describe('add purchase flow', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'buyer@example.com', displayName: 'Buyer', password: buyerPassword, isAdmin: false },
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

  it('lists the products of a two-line purchase on the stock page', async () => {
    const buyerCookie = await logIn('buyer@example.com', buyerPassword)
    const createProduct = (name: string) =>
      $fetch<{ id: string }>('/api/products', {
        method: 'POST',
        body: { name, category: 'pokemon-sealed' },
        headers: { cookie: buyerCookie },
      })
    const firstProduct = await createProduct('Display Écarlate et Violet')
    const secondProduct = await createProduct('Coffret Dresseur d’élite')

    await $fetch('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: '2026-11-02',
        totalPriceCents: 15000,
        feesCents: 0,
        inTransit: false,
        lines: [
          { productId: firstProduct.id, condition: 'sealed-new' },
          { productId: secondProduct.id, condition: 'sealed-new' },
        ],
      },
      headers: { cookie: buyerCookie },
    })

    const stockPage = await fetch('/stock', { headers: { cookie: buyerCookie } })
    const stockPageHtml = await stockPage.text()

    expect(stockPage.status).toBe(200)
    expect(stockPageHtml).toContain('Display Écarlate et Violet')
    expect(stockPageHtml).toContain('Coffret Dresseur d’élite')
  })
})
