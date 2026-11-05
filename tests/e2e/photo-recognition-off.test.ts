import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const scannerPassword = 'scanner-user-password'

describe('photo recognition switched off', async () => {
  const previousMode = process.env.NUXT_PHOTO_RECOGNITION
  process.env.NUXT_PHOTO_RECOGNITION = 'off'
  const databaseUrl = await seedAccounts([
    { email: 'scanner@example.com', displayName: 'Scanner', password: scannerPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)
  afterAll(() => {
    if (previousMode === undefined) delete process.env.NUXT_PHOTO_RECOGNITION
    else process.env.NUXT_PHOTO_RECOGNITION = previousMode
  })

  it('reports the feature as unavailable', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)

    const response = await fetch('/api/settings/features', { headers: { cookie } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ photoRecognition: false })
  })

  it('answers 401 to an anonymous caller of the features endpoint', async () => {
    expect((await fetch('/api/settings/features')).status).toBe(401)
  })

  it('answers 503 with the French message on both photo endpoints', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)

    const identification = await fetch('/api/scan/photo', { method: 'POST', body: new FormData(), headers: { cookie } })
    const confirmation = await fetch('/api/scan/photo/confirm', {
      method: 'POST',
      body: JSON.stringify({ uploadFingerprint: 'abc', productId: '00000000-0000-4000-8000-000000000000' }),
      headers: { 'content-type': 'application/json', cookie },
    })

    expect(identification.status).toBe(503)
    expect(await identification.text()).toContain('reconnaissance photo désactivée sur ce serveur')
    expect(confirmation.status).toBe(503)
  })

  it('renders the text search variant on the server whatever the requested tab', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)

    const page = await fetch('/ajouter?onglet=photo', { headers: { cookie } })
    const pageHtml = await page.text()

    expect(page.status).toBe(200)
    expect(pageHtml).not.toContain('capture="environment"')
    expect(pageHtml).toContain('Le scan par code-barres et par photo se fait depuis l’iPhone.')
  })
})
