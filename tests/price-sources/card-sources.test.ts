import { readFileSync } from 'node:fs'
import { fetchTcgdexCardAggregate, searchTcgdexCards } from '../../src/price-sources/tcgdex/tcgdex-adapter.ts'
import { fetchPokemontcgCardAggregate, searchPokemontcgCards } from '../../src/price-sources/pokemontcg/pokemontcg-adapter.ts'

const readFixtureText = (fixturePath: string): string =>
  readFileSync(new URL(`../fixtures/${fixturePath}`, import.meta.url), 'utf8')

const recordingFetch = (fixturePath: string) => {
  const requests: { url: string; init: RequestInit }[] = []
  const fetchFunction = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ url: String(url), init: init ?? {} })
    return new Response(readFixtureText(fixturePath), { status: 200 })
  }
  return { requests, fetchFunction }
}

describe('TCGdex', () => {
  it('finds cards by their French name', async () => {
    const { fetchFunction } = recordingFetch('tcgdex/search-dracaufeu.json')
    const candidates = await searchTcgdexCards('Dracaufeu', fetchFunction)
    expect(candidates.length).toBeGreaterThan(10)
    for (const candidate of candidates) {
      expect(candidate.source).toBe('tcgdex')
      expect(candidate.name).toContain('Dracaufeu')
    }
  })

  it('sends accents and apostrophes percent-encoded', async () => {
    const { requests, fetchFunction } = recordingFetch('tcgdex/search-dracaufeu.json')
    await searchTcgdexCards("Dresseur d'Élite", fetchFunction)
    expect(requests[0]?.url).toBe('https://api.tcgdex.net/v2/fr/cards?name=Dresseur+d%27%C3%89lite')
  })

  it('reads the Cardmarket prices of a card and its Cardmarket id', async () => {
    const { requests, fetchFunction } = recordingFetch('tcgdex/card-sv08.5-161.json')
    const aggregate = await fetchTcgdexCardAggregate('sv08.5-161', fetchFunction)
    expect(requests[0]?.url).toBe('https://api.tcgdex.net/v2/fr/cards/sv08.5-161')
    expect(aggregate).toMatchObject({
      source: 'tcgdex',
      sourceProductId: '805555',
      averageCents: 101899,
      lowCents: 69855,
      trendCents: 91670,
      average7DaysCents: 102337,
      average30DaysCents: 105871,
    })
  })
})

describe('pokemontcg.io', () => {
  afterEach(() => {
    delete process.env.POKEMONTCG_API_KEY
  })

  it('finds cards with their set and image', async () => {
    const { requests, fetchFunction } = recordingFetch('pokemontcg/search-charizard.json')
    const candidates = await searchPokemontcgCards('Charizard', fetchFunction)
    expect(new URL(requests[0]!.url).searchParams.get('q')).toBe('name:"Charizard"')
    expect(candidates[0]).toEqual({
      source: 'pokemontcg',
      sourceCardId: 'sv3pt5-6',
      name: 'Charizard ex',
      setName: '151',
      imageUrl: 'https://images.pokemontcg.io/sv3pt5/6.png',
    })
  })

  it('reads the Cardmarket prices of a card', async () => {
    const { fetchFunction } = recordingFetch('pokemontcg/search-charizard.json')
    const aggregate = await fetchPokemontcgCardAggregate('sv3pt5-6', fetchFunction)
    expect(aggregate).toMatchObject({ source: 'pokemontcg', sourceProductId: 'sv3pt5-6', averageCents: 2450, lowCents: 1800, trendCents: 2312, average7DaysCents: 2380, average30DaysCents: 2541 })
  })

  it('sends the key only when it is set', async () => {
    const withoutKey = recordingFetch('pokemontcg/search-charizard.json')
    await searchPokemontcgCards('Charizard', withoutKey.fetchFunction)
    expect(new Headers(withoutKey.requests[0]?.init.headers).has('x-api-key')).toBe(false)

    process.env.POKEMONTCG_API_KEY = 'secret-key'
    const withKey = recordingFetch('pokemontcg/search-charizard.json')
    await searchPokemontcgCards('Charizard', withKey.fetchFunction)
    expect(new Headers(withKey.requests[0]?.init.headers).get('x-api-key')).toBe('secret-key')
  })
})
