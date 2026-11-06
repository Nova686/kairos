import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-123'
const listingUrl = 'https://www.ebay.fr/itm/123456789'

const sendListingUrl = (productId: string, method: 'POST' | 'DELETE', cookie: string, body: unknown) =>
  fetch(`/api/products/${productId}/excluded-listings`, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('listing exclusions API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('excludes a listing from the product prices, then restores it', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Flammes Obsidiennes', category: 'pokemon-sealed' },
      headers: { cookie },
    })

    const exclusion = await sendListingUrl(product.id, 'POST', cookie, { url: listingUrl })
    const pricesAfterExclusion = await $fetch<{ excludedListingUrls: string[] }>(`/api/products/${product.id}/prices`, { headers: { cookie } })
    const restoration = await sendListingUrl(product.id, 'DELETE', cookie, { url: listingUrl })
    const pricesAfterRestoration = await $fetch<{ excludedListingUrls: string[] }>(`/api/products/${product.id}/prices`, { headers: { cookie } })

    expect(exclusion.status).toBe(204)
    expect(pricesAfterExclusion.excludedListingUrls).toHaveLength(1)
    expect(restoration.status).toBe(204)
    expect(pricesAfterRestoration.excludedListingUrls).toEqual([])
  })

  it('answers 422 for a missing URL and 404 for an unknown product', async () => {
    const cookie = await logIn('member@example.com', memberPassword)

    const missingUrl = await sendListingUrl('00000000-0000-4000-8000-000000000000', 'POST', cookie, { url: '  ' })
    const unknownProduct = await sendListingUrl('00000000-0000-4000-8000-000000000000', 'POST', cookie, { url: listingUrl })

    expect(missingUrl.status).toBe(422)
    expect(unknownProduct.status).toBe(404)
  })
})
