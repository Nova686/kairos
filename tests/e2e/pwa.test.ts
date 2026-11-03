import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'

describe('progressive web app installation', async () => {
  await startEndToEndServer()

  it('serves a standalone French manifest with the install icons', async () => {
    const response = await fetch('/manifest.webmanifest')
    const manifest = await response.json()

    expect(response.status).toBe(200)
    expect(manifest).toMatchObject({
      name: 'Kairos',
      short_name: 'Kairos',
      lang: 'fr',
      display: 'standalone',
      start_url: '/',
      theme_color: '#1e5a8a',
    })
    expect(manifest.icons.map((icon: { sizes: string, purpose?: string }) => `${icon.sizes}:${icon.purpose ?? 'any'}`).sort())
      .toEqual(['192x192:any', '512x512:any', '512x512:maskable'])
  })

  it('declares the Apple home screen tags and the manifest on the home page', async () => {
    const html = await (await fetch('/')).text()

    expect(html).toContain('apple-touch-icon')
    expect(html).toContain('apple-mobile-web-app-capable')
    expect(html).toContain('apple-mobile-web-app-status-bar-style')
    expect(html).toContain('rel="manifest"')
  })

  it('serves the icon files', async () => {
    for (const iconPath of ['/icons/kairos-192.png', '/icons/kairos-512.png', '/icons/kairos-maskable-512.png', '/apple-touch-icon.png']) {
      const response = await fetch(iconPath)
      expect(response.status, iconPath).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
    }
  })
})
