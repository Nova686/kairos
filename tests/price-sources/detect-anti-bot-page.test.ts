import { readFileSync } from 'node:fs'
import { detectAntiBotPage } from '../../src/price-sources/browser/detect-anti-bot-page.ts'

const readAntiBotFixture = (fixtureName: string): string =>
  readFileSync(new URL(`../fixtures/anti-bot/${fixtureName}`, import.meta.url), 'utf8')

describe('detectAntiBotPage', () => {
  it('reports a forbidden answer', () => {
    expect(detectAntiBotPage(403, '<html></html>')).toBe('http-403')
  })

  it('reports a DataDome challenge served with 200', () => {
    expect(detectAntiBotPage(200, readAntiBotFixture('datadome.html'))).toBe('datadome')
  })

  it('reports a Cloudflare challenge served with 200', () => {
    expect(detectAntiBotPage(200, readAntiBotFixture('cloudflare.html'))).toBe('cloudflare-challenge')
  })

  it('reports a generic captcha served with 200', () => {
    expect(detectAntiBotPage(200, readAntiBotFixture('captcha.html'))).toBe('captcha')
  })

  it('accepts a normal results page', () => {
    expect(detectAntiBotPage(200, readAntiBotFixture('normal-results.html'))).toBeNull()
  })
})
