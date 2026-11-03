import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'

const readPngDimensions = (png: Buffer): { width: number, height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
})

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

  it('serves icons with the exact sizes iOS and the manifest expect', async () => {
    const expectedSizes: Record<string, number> = {
      '/apple-touch-icon.png': 180,
      '/icons/kairos-192.png': 192,
      '/icons/kairos-512.png': 512,
      '/icons/kairos-maskable-512.png': 512,
    }
    for (const [iconPath, expectedSize] of Object.entries(expectedSizes)) {
      const png = Buffer.from(await (await fetch(iconPath)).arrayBuffer())
      expect(readPngDimensions(png), iconPath).toEqual({ width: expectedSize, height: expectedSize })
    }
  })

  it('keeps the service worker away from pages: no navigation route, no precached page', async () => {
    const response = await fetch('/sw.js')
    const serviceWorker = await response.text()

    expect(response.status).toBe(200)
    expect(serviceWorker).not.toContain('NavigationRoute')
    expect(serviceWorker).not.toMatch(/url:\s*["']\/["']/)
    expect(serviceWorker).not.toMatch(/\.html["']/)
  })
})
