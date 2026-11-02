import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { formatEuros } from '../../app/utils/format-euros.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const sellerPassword = 'seller-user-password'

describe('sale flow', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'seller@example.com', displayName: 'Seller', password: sellerPassword, isAdmin: false },
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

  it('shows a created sale with its platform and profit, then its delivery and debt screens', async () => {
    const sellerCookie = await logIn('seller@example.com', sellerPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Écarlate', category: 'pokemon-sealed' },
      headers: { cookie: sellerCookie },
    })
    const purchase = await $fetch<{ stockItems: { id: string }[] }>('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: '2026-11-02',
        totalPriceCents: 1000,
        lines: [{ productId: product.id, condition: 'sealed-new', allocatedPurchaseCents: 1000 }],
      },
      headers: { cookie: sellerCookie },
    })
    const buyer = await $fetch<{ id: string }>('/api/persons', {
      method: 'POST',
      body: { name: 'Camille' },
      headers: { cookie: sellerCookie },
    })
    const createdSale = await $fetch<{ sale: { id: string } }>('/api/sales', {
      method: 'POST',
      body: {
        soldOn: '2026-11-03',
        platform: 'Leboncoin',
        buyerPersonId: buyer.id,
        totalPriceCents: 5000,
        trackingReference: 'LP999',
        stockItemIds: purchase.stockItems.map(stockItem => stockItem.id),
      },
      headers: { cookie: sellerCookie },
    })
    await $fetch('/api/debts', {
      method: 'POST',
      body: {
        personId: buyer.id,
        amountCents: 5000,
        direction: 'owed-to-me',
        reason: 'Vente non encore payée',
        saleId: createdSale.sale.id,
        createdOn: '2026-11-03',
      },
      headers: { cookie: sellerCookie },
    })

    const salesPage = await fetch('/ventes', { headers: { cookie: sellerCookie } })
    const salesPageHtml = await salesPage.text()
    const deliveriesPage = await fetch('/livraisons', { headers: { cookie: sellerCookie } })
    const deliveriesPageHtml = await deliveriesPage.text()
    const debtsPage = await fetch('/dettes', { headers: { cookie: sellerCookie } })
    const debtsPageHtml = await debtsPage.text()

    expect(salesPage.status).toBe(200)
    expect(salesPageHtml).toContain('Leboncoin')
    expect(salesPageHtml).toContain(formatEuros(4000))
    expect(deliveriesPage.status).toBe(200)
    expect(deliveriesPageHtml).toContain('Display Écarlate')
    expect(deliveriesPageHtml).toContain('LP999')
    expect(debtsPage.status).toBe(200)
    expect(debtsPageHtml).toContain('Camille')
    expect(debtsPageHtml).toContain(formatEuros(5000))
  })
})
