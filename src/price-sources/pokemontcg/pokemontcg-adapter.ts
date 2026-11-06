import { requestSourceJson } from '../../source-http/request-source-json.ts'
import type { FetchFunction } from '../../source-http/request-source-json.ts'
import type { CardCandidate } from '../card-candidate.ts'
import { euroFigureToCents } from '../price-source-types.ts'
import type { SourceAggregate } from '../price-source-types.ts'

const pokemontcgCardsEndpoint = 'https://api.pokemontcg.io/v2/cards'

interface PokemontcgCard {
  id: string
  name: string
  set?: { name?: string }
  images?: { small?: string }
  cardmarket?: {
    updatedAt?: string
    prices?: {
      averageSellPrice?: number | null
      lowPrice?: number | null
      trendPrice?: number | null
      avg7?: number | null
      avg30?: number | null
    }
  }
}

const requestPokemontcgCards = async (searchQuery: string, fetchFunction?: FetchFunction): Promise<PokemontcgCard[]> => {
  const apiKey = process.env.POKEMONTCG_API_KEY
  const searchUrl = `${pokemontcgCardsEndpoint}?${new URLSearchParams({ q: searchQuery, pageSize: '50' }).toString()}`
  const cardPage = await requestSourceJson<{ data: PokemontcgCard[] }>(
    'pokemontcg',
    searchUrl,
    { headers: apiKey ? { 'x-api-key': apiKey } : {} },
    fetchFunction,
  )
  return cardPage?.data ?? []
}

const quoteForPokemontcgQuery = (value: string): string => `"${value.replace(/"/g, '')}"`

export const searchPokemontcgCards = async (name: string, fetchFunction?: FetchFunction): Promise<CardCandidate[]> => {
  const cards = await requestPokemontcgCards(`name:${quoteForPokemontcgQuery(name)}`, fetchFunction)
  return cards.map((card) => ({
    source: 'pokemontcg',
    sourceCardId: card.id,
    name: card.name,
    setName: card.set?.name ?? null,
    imageUrl: card.images?.small ?? null,
  }))
}

export const fetchPokemontcgCardAggregate = async (
  cardId: string,
  fetchFunction?: FetchFunction,
): Promise<SourceAggregate | null> => {
  const cards = await requestPokemontcgCards(`id:${quoteForPokemontcgQuery(cardId)}`, fetchFunction)
  const matchingCard = cards.find((card) => card.id === cardId)
  const cardmarketPrices = matchingCard?.cardmarket?.prices
  if (!cardmarketPrices) {
    return null
  }
  return {
    source: 'pokemontcg',
    sourceProductId: cardId,
    averageCents: euroFigureToCents(cardmarketPrices.averageSellPrice),
    lowCents: euroFigureToCents(cardmarketPrices.lowPrice),
    trendCents: euroFigureToCents(cardmarketPrices.trendPrice),
    average7DaysCents: euroFigureToCents(cardmarketPrices.avg7),
    average30DaysCents: euroFigureToCents(cardmarketPrices.avg30),
    observedAt: matchingCard.cardmarket?.updatedAt ?? new Date().toISOString(),
  }
}
