import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const password = 'catalogue-user-password'

const sendJson = (path: string, method: string, cookie: string, body?: unknown) =>
  fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('shared catalogue API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'catalogue@example.com', displayName: 'Catalogue', password, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/products')).status).toBe(401)
    expect((await fetch('/api/catalogue/search?q=display')).status).toBe(401)
  })

  it('creates, edits, journals and reverts a product', async () => {
    const cookie = await logIn('catalogue@example.com', password)
    const createdProduct = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display EV1', category: 'pokemon-sealed' },
      headers: { cookie },
    })

    await sendJson(`/api/products/${createdProduct.id}`, 'PATCH', cookie, { name: 'Vandalisé' })
    const changes = await $fetch<{ id: string, fieldName: string }[]>(`/api/products/${createdProduct.id}/changes`, {
      headers: { cookie },
    })
    const nameChange = changes.find(change => change.fieldName === 'name')!
    const revertedProduct = await $fetch<{ name: string }>(`/api/catalogue-changes/${nameChange.id}/revert`, {
      method: 'POST',
      headers: { cookie },
    })

    expect(revertedProduct.name).toBe('Display EV1')
    expect((await sendJson('/api/products', 'POST', cookie, { name: '', category: 'nope' })).status).toBe(422)
  })

  it('links a barcode once and answers 404 for an unknown barcode', async () => {
    const cookie = await logIn('catalogue@example.com', password)
    const createdProduct = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Booster', category: 'pokemon-sealed' },
      headers: { cookie },
    })

    const attachResponse = await sendJson(`/api/products/${createdProduct.id}/barcodes`, 'POST', cookie, {
      barcode: '3665361000001',
    })
    const foundResponse = await sendJson('/api/barcodes/3665361000001', 'GET', cookie)
    const unknownResponse = await sendJson('/api/barcodes/0000000000000', 'GET', cookie)

    expect(attachResponse.status).toBe(204)
    expect(((await foundResponse.json()) as { id: string }).id).toBe(createdProduct.id)
    expect(unknownResponse.status).toBe(404)
  })
})
