import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-123'
const lipstickBarcode = '3614272049529'

const linkBarcode = (barcode: string, productId: string, cookie: string) =>
  fetch(`/api/scan/barcode/${barcode}/link`, {
    method: 'POST',
    body: JSON.stringify({ productId }),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('barcode scan API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 422 for a barcode with a wrong length or check digit', async () => {
    const cookie = await logIn('member@example.com', memberPassword)

    const identification = await fetch('/api/scan/barcode/123', { headers: { cookie } })
    const link = await linkBarcode('3614272049520', '00000000-0000-4000-8000-000000000000', cookie)

    expect(identification.status).toBe(422)
    expect(link.status).toBe(422)
  })

  it('links a barcode once, answers 409 for another product and then identifies the linked product', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const createProduct = (name: string) =>
      $fetch<{ id: string }>('/api/products', { method: 'POST', body: { name, category: 'makeup' }, headers: { cookie } })
    const lipstick = await createProduct('Rouge Pur Couture')
    const otherLipstick = await createProduct('Rouge Volupté')

    const firstLink = await linkBarcode(lipstickBarcode, lipstick.id, cookie)
    const repeatedLink = await linkBarcode(lipstickBarcode, lipstick.id, cookie)
    const conflictingLink = await linkBarcode(lipstickBarcode, otherLipstick.id, cookie)
    const identification = await $fetch<{ knownProduct: { id: string } | null }>(`/api/scan/barcode/${lipstickBarcode}`, { headers: { cookie } })

    expect(firstLink.status).toBe(200)
    expect(repeatedLink.status).toBe(200)
    expect(conflictingLink.status).toBe(409)
    expect((await conflictingLink.json()).statusMessage).toBe('Ce code-barres est déjà lié à un autre produit')
    expect(identification.knownProduct?.id).toBe(lipstick.id)
  })
})
