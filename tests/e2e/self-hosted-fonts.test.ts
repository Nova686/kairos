import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'

const selfHostedFontFiles = [
  '/fonts/sora/sora-latin-600-normal.woff2',
  '/fonts/sora/sora-latin-ext-600-normal.woff2',
  '/fonts/sora/sora-latin-700-normal.woff2',
  '/fonts/sora/sora-latin-ext-700-normal.woff2',
  '/fonts/ibm-plex-sans/ibm-plex-sans-latin-400-normal.woff2',
  '/fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-400-normal.woff2',
  '/fonts/ibm-plex-sans/ibm-plex-sans-latin-500-normal.woff2',
  '/fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-500-normal.woff2',
  '/fonts/ibm-plex-sans/ibm-plex-sans-latin-600-normal.woff2',
  '/fonts/ibm-plex-sans/ibm-plex-sans-latin-ext-600-normal.woff2',
  '/fonts/ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2',
  '/fonts/ibm-plex-mono/ibm-plex-mono-latin-ext-500-normal.woff2',
  '/fonts/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2',
  '/fonts/ibm-plex-mono/ibm-plex-mono-latin-ext-600-normal.woff2',
]

const coffreFontFamilies = ['Sora', 'IBM Plex Sans', 'IBM Plex Mono']

const pageOrigin = 'http://kairos.test'

interface FontFace {
  family: string | undefined
  weight: string | undefined
  isSwapped: boolean
  sourcePaths: string[]
}

interface ServedStylesheet {
  servedPath: string
  text: string
}

const readFontFaces = ({ servedPath, text }: ServedStylesheet): FontFace[] =>
  (text.match(/@font-face\s*\{[^}]*\}/g) ?? []).map(declaration => ({
    family: /font-family:\s*["']?([^"';]+)["']?/.exec(declaration)?.[1],
    weight: /font-weight:\s*(\d+)/.exec(declaration)?.[1],
    isSwapped: /font-display:\s*swap/.test(declaration),
    sourcePaths: [...declaration.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      .map(sourceUrl => new URL(sourceUrl[1]!, new URL(servedPath, pageOrigin)).pathname),
  }))

const readPageWithStylesheets = async (path: string): Promise<{ pageHtml: string, stylesheets: ServedStylesheet[] }> => {
  const pageHtml = await (await fetch(path)).text()
  const linkedStylesheetPaths = [...pageHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(link => link[1]!)
  const linkedStylesheets = await Promise.all(linkedStylesheetPaths.map(async stylesheetPath =>
    ({ servedPath: stylesheetPath, text: await (await fetch(stylesheetPath)).text() })))
  return { pageHtml, stylesheets: [{ servedPath: path, text: pageHtml }, ...linkedStylesheets] }
}

describe('self-hosted fonts and brand colours', async () => {
  await startEndToEndServer()

  it('loads no font from a third party', async () => {
    const { pageHtml, stylesheets } = await readPageWithStylesheets('/connexion')
    const declaredSources = stylesheets.flatMap(stylesheet => [...stylesheet.text.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(sourceUrl => sourceUrl[1]!))

    expect(pageHtml).not.toContain('fonts.googleapis.com')
    expect(pageHtml).not.toContain('fonts.gstatic.com')
    expect(declaredSources.filter(source => /^(https?:)?\/\//.test(source))).toEqual([])
  })

  it('declares the Coffre families and weights from the local font files with a swap display', async () => {
    const { stylesheets } = await readPageWithStylesheets('/connexion')
    const coffreFontFaces = stylesheets.flatMap(readFontFaces).filter(fontFace => coffreFontFamilies.includes(fontFace.family ?? ''))

    expect([...new Set(coffreFontFaces.map(fontFace => `${fontFace.family} ${fontFace.weight}`))].sort()).toEqual([
      'IBM Plex Mono 500',
      'IBM Plex Mono 600',
      'IBM Plex Sans 400',
      'IBM Plex Sans 500',
      'IBM Plex Sans 600',
      'Sora 600',
      'Sora 700',
    ])
    expect(coffreFontFaces.every(fontFace => fontFace.isSwapped)).toBe(true)
    expect(coffreFontFaces.flatMap(fontFace => fontFace.sourcePaths).sort()).toEqual([...selfHostedFontFiles].sort())
  })

  it('serves every font file and its licence', async () => {
    for (const fontFile of selfHostedFontFiles) {
      const response = await fetch(fontFile)
      const fontBytes = Buffer.from(await response.arrayBuffer())
      expect(response.status, fontFile).toBe(200)
      expect(fontBytes.subarray(0, 4).toString('latin1'), fontFile).toBe('wOF2')
    }
    for (const family of ['sora', 'ibm-plex-sans', 'ibm-plex-mono']) {
      const licence = await fetch(`/fonts/${family}/OFL.txt`)
      expect(licence.status, family).toBe(200)
      expect(await licence.text(), family).toContain('SIL OPEN FONT LICENSE Version 1.1')
    }
  })

  it('declares the brand colours in the server-rendered head, before any script runs', async () => {
    const { pageHtml } = await readPageWithStylesheets('/connexion')
    const head = pageHtml.slice(0, pageHtml.indexOf('</head>'))

    expect(head).toMatch(/<style[^>]*>:root\{--kairos-background:#0b0f14;[^<]*--kairos-text-secondary:#8b97a8;/)
  })

  it('precaches the font files in the service worker so the installed app has its fonts offline', async () => {
    const serviceWorker = await (await fetch('/sw.js')).text()

    for (const fontFile of selfHostedFontFiles) {
      expect(serviceWorker, fontFile).toContain(fontFile.slice(1))
    }
  })
})
