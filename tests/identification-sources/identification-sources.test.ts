import { readFileSync } from 'node:fs'
import { lookupOpenBeautyFacts } from '../../src/identification-sources/open-beauty-facts.ts'
import { lookupPsaCertificate } from '../../src/identification-sources/psa-certificate.ts'
import { lookupUpcitemdb } from '../../src/identification-sources/upcitemdb.ts'
import { SourceBlockedError, SourceDisabledError } from '../../src/price-sources/price-source-types.ts'

const recordingFetch = (fixtureName: string | null, status = 200) => {
  const requests: { url: string; init: RequestInit }[] = []
  const fetchFunction = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ url: String(url), init: init ?? {} })
    const body = fixtureName
      ? readFileSync(new URL(`../fixtures/identification/${fixtureName}`, import.meta.url), 'utf8')
      : '{}'
    return new Response(body, { status })
  }
  return { requests, fetchFunction }
}

describe('UPCitemdb', () => {
  it('identifies a product from its barcode', async () => {
    const { requests, fetchFunction } = recordingFetch('upcitemdb-found.json')
    const identification = await lookupUpcitemdb('0820650853715', fetchFunction)
    expect(requests[0]?.url).toBe('https://api.upcitemdb.com/prod/trial/lookup?upc=0820650853715')
    expect(identification?.name.startsWith('Pokemon TCG: Paldea Evolved Build & Battle Box')).toBe(true)
    expect(identification).toMatchObject({ source: 'upcitemdb', brand: 'The Pokemon Company International', barcode: '0820650853715' })
    expect(identification?.imageUrl).toMatch(/^https:\/\//)
  })

  it('returns null for an unknown barcode', async () => {
    const { fetchFunction } = recordingFetch(null)
    expect(await lookupUpcitemdb('0000000000000', fetchFunction)).toBeNull()
  })

  it('reports the daily limit as a block', async () => {
    const { fetchFunction } = recordingFetch(null, 429)
    const failure = await lookupUpcitemdb('0820650853715', fetchFunction).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SourceBlockedError)
    expect(failure).toMatchObject({ reason: 'http-429' })
  })
})

describe('Open Beauty Facts', () => {
  it('identifies a cosmetic from its barcode', async () => {
    const { requests, fetchFunction } = recordingFetch('openbeautyfacts-found.json')
    const identification = await lookupOpenBeautyFacts('8005610625645', fetchFunction)
    expect(requests[0]?.url).toBe(
      'https://world.openbeautyfacts.org/api/v2/product/8005610625645.json?fields=product_name%2Cbrands%2Cimage_front_url',
    )
    expect(identification).toMatchObject({
      source: 'openbeautyfacts',
      name: 'Lipfinity Lip Colour 330 Essential Burgundy 2-Step Longlasting Lipstick',
      brand: 'Max Factor',
      barcode: '8005610625645',
    })
  })

  it('returns null when the product is unknown', async () => {
    const { fetchFunction } = recordingFetch('openbeautyfacts-not-found.json')
    expect(await lookupOpenBeautyFacts('3600523307722', fetchFunction)).toBeNull()
  })
})

describe('PSA certificate', () => {
  afterEach(() => {
    delete process.env.PSA_API_TOKEN
  })

  it('identifies a graded card from its certificate', async () => {
    process.env.PSA_API_TOKEN = 'psa-token'
    const { requests, fetchFunction } = recordingFetch('psa-certificate.json')
    const identification = await lookupPsaCertificate('12345678', fetchFunction)
    expect(requests[0]?.url).toBe('https://api.psacard.com/publicapi/cert/GetByCertNumber/12345678')
    expect(new Headers(requests[0]?.init.headers).get('authorization')).toBe('bearer psa-token')
    expect(identification).toMatchObject({
      source: 'psa',
      name: '2023 POKEMON SV3.5 151 CHARIZARD EX #199',
      gradingCompany: 'PSA',
      grade: '10',
      certificateNumber: '12345678',
    })
  })

  it('disables PSA without a token', async () => {
    const { fetchFunction } = recordingFetch('psa-certificate.json')
    await expect(lookupPsaCertificate('12345678', fetchFunction)).rejects.toBeInstanceOf(SourceDisabledError)
  })
})
