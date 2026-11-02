import { readFileSync } from 'node:fs'
import { buildEbaySearchUrl } from '../../../src/price-sources/ebay/ebay-adapter.ts'
import { fetchEbayAccessToken, forgetEbayAccessToken } from '../../../src/price-sources/ebay/ebay-access-token.ts'
import { parseEbayItemSummaries } from '../../../src/price-sources/ebay/parse-ebay-item-summaries.ts'
import { SourceDisabledError } from '../../../src/price-sources/price-source-types.ts'

const ebaySearchFixture: unknown = JSON.parse(
  readFileSync(new URL('../../fixtures/ebay/item-summary-search.json', import.meta.url), 'utf8'),
)

describe('parseEbayItemSummaries', () => {
  const observations = parseEbayItemSummaries(ebaySearchFixture)

  it('keeps euro listings once each', () => {
    expect(observations.map((observation) => observation.priceCents)).toEqual([6490, 7200])
  })

  it('reads the condition, shipping and image', () => {
    expect(observations[0]).toMatchObject({
      source: 'ebay',
      kind: 'active',
      sourceCondition: 'Neuf',
      shippingCents: 650,
      url: 'https://www.ebay.fr/itm/100000000001',
      imageUrl: 'https://i.ebayimg.com/images/g/aaa/s-l225.jpg',
    })
    expect(observations[1]).toMatchObject({ sourceCondition: 'Occasion', shippingCents: null, imageUrl: null })
  })

  it('returns nothing for an empty search', () => {
    expect(parseEbayItemSummaries({ total: 0 })).toEqual([])
  })
})

describe('buildEbaySearchUrl', () => {
  it('encodes accents and filters by condition', () => {
    const searchUrl = new URL(buildEbaySearchUrl("Coffret Dresseur d'Élite", [1000, 3000]))
    expect(searchUrl.origin + searchUrl.pathname).toBe('https://api.ebay.com/buy/browse/v1/item_summary/search')
    expect(searchUrl.searchParams.get('q')).toBe("Coffret Dresseur d'Élite")
    expect(searchUrl.searchParams.get('limit')).toBe('100')
    expect(searchUrl.searchParams.get('filter')).toBe('conditionIds:{1000|3000}')
  })

  it('omits the filter without conditions', () => {
    expect(new URL(buildEbaySearchUrl('ETB', [])).searchParams.has('filter')).toBe(false)
  })
})

describe('fetchEbayAccessToken', () => {
  beforeEach(() => {
    forgetEbayAccessToken()
    process.env.EBAY_CLIENT_ID = 'client-id'
    process.env.EBAY_CLIENT_SECRET = 'client-secret'
  })

  it('asks a client-credentials token once and reuses it', async () => {
    const tokenRequests: { url: string; init: RequestInit }[] = []
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      tokenRequests.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ access_token: 'token-1', expires_in: 7200 }), { status: 200 })
    }
    expect(await fetchEbayAccessToken(fakeFetch)).toBe('token-1')
    expect(await fetchEbayAccessToken(fakeFetch)).toBe('token-1')
    expect(tokenRequests).toHaveLength(1)
    expect(tokenRequests[0]?.url).toBe('https://api.ebay.com/identity/v1/oauth2/token')
    expect(new Headers(tokenRequests[0]?.init.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
    )
    expect(String(tokenRequests[0]?.init.body)).toBe(
      'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    )
  })

  it('disables eBay without keys', async () => {
    delete process.env.EBAY_CLIENT_ID
    await expect(fetchEbayAccessToken()).rejects.toBeInstanceOf(SourceDisabledError)
  })
})
