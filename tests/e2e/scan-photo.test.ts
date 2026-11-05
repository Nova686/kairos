import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const scannerPassword = 'scanner-user-password'

const photoForm = (content: Uint8Array, fieldName = 'photo'): FormData => {
  const form = new FormData()
  form.append(fieldName, new Blob([content as BlobPart], { type: 'image/jpeg' }), 'photo.jpg')
  return form
}

describe('photo identification API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'scanner@example.com', displayName: 'Scanner', password: scannerPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/scan/photo', { method: 'POST', body: photoForm(Uint8Array.from([0xff, 0xd8, 0xff])) })).status).toBe(401)
    expect((await fetch('/api/scan/photo/confirm', { method: 'POST' })).status).toBe(401)
  })

  it('rejects a missing field, a HEIC file and an oversized photo with a French message', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)
    const heicHeader = Uint8Array.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    const oversizedJpeg = new Uint8Array(5 * 1024 * 1024 + 1)
    oversizedJpeg.set([0xff, 0xd8, 0xff])

    const missingField = await fetch('/api/scan/photo', { method: 'POST', body: photoForm(heicHeader, 'other'), headers: { cookie } })
    const heic = await fetch('/api/scan/photo', { method: 'POST', body: photoForm(heicHeader), headers: { cookie } })
    const oversized = await fetch('/api/scan/photo', { method: 'POST', body: photoForm(oversizedJpeg), headers: { cookie } })

    expect(missingField.status).toBe(422)
    expect(heic.status).toBe(415)
    expect(await heic.text()).toContain('JPEG ou PNG')
    expect(oversized.status).toBe(413)
    expect(await oversized.text()).toContain('5 Mo')
  })

  it('answers 415 with a French message for a JPEG header followed by garbage', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)
    const corruptJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...Buffer.from('garbage-not-a-jpeg-at-all')])

    const response = await fetch('/api/scan/photo', { method: 'POST', body: photoForm(corruptJpeg), headers: { cookie } })

    expect(response.status).toBe(415)
    expect(await response.text()).toContain('Photo illisible, réessayez avec une autre photo.')
  })

  it('serves the add page in its text search variant and leaves the scan tabs to phones after mount', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)

    const page = await fetch('/ajouter?onglet=photo', { headers: { cookie } })
    const pageHtml = await page.text()

    expect(page.status).toBe(200)
    expect(pageHtml).toContain('Le scan par code-barres et par photo se fait depuis l’iPhone.')
    expect(pageHtml).not.toContain('arrive bientôt')
  })

  it('validates the confirmation body and answers 404 for an unknown photo', async () => {
    const cookie = await logIn('scanner@example.com', scannerPassword)
    const sendConfirmation = (body: unknown) =>
      fetch('/api/scan/photo/confirm', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', cookie },
      })

    const invalid = await sendConfirmation({ uploadFingerprint: 'abc', productId: 'not-a-uuid' })
    const unknownPhoto = await sendConfirmation({ uploadFingerprint: 'abc', productId: '00000000-0000-4000-8000-000000000000' })

    expect(invalid.status).toBe(422)
    expect(unknownPhoto.status).toBe(404)
  })
})
