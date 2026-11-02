import { requestSourceJson } from '../../source-http/request-source-json.ts'
import type { FetchFunction } from '../../source-http/request-source-json.ts'
import type { CardCandidate } from '../card-candidate.ts'
import { euroFigureToCents } from '../price-source-types.ts'
import type { SourceAggregate } from '../price-source-types.ts'

const tcgdexFrenchCardsEndpoint = 'https://api.tcgdex.net/v2/fr/cards'

interface TcgdexCardBrief {
  id: string
  name: string
  image?: string
}

interface TcgdexCardmarketPricing {
  updated: string
  unit: string
  idProduct: number
  avg: number | null
  low: number | null
  trend: number | null
  avg7: number | null
  avg30: number | null
}

interface TcgdexCard extends TcgdexCardBrief {
  set?: { name?: string }
  pricing?: { cardmarket?: TcgdexCardmarketPricing | null }
}

const tcgdexImageUrl = (imageBase: string | undefined): string | null =>
  imageBase ? `${imageBase}/high.webp` : null

export const searchTcgdexCards = async (frenchName: string, fetchFunction?: FetchFunction): Promise<CardCandidate[]> => {
  const searchUrl = `${tcgdexFrenchCardsEndpoint}?${new URLSearchParams({ name: frenchName }).toString()}`
  const cardBriefs = await requestSourceJson<TcgdexCardBrief[]>('tcgdex', searchUrl, {}, fetchFunction)
  return (cardBriefs ?? []).map((cardBrief) => ({
    source: 'tcgdex',
    sourceCardId: cardBrief.id,
    name: cardBrief.name,
    setName: null,
    imageUrl: tcgdexImageUrl(cardBrief.image),
  }))
}

export const fetchTcgdexCardAggregate = async (
  cardId: string,
  fetchFunction?: FetchFunction,
): Promise<SourceAggregate | null> => {
  const card = await requestSourceJson<TcgdexCard>('tcgdex', `${tcgdexFrenchCardsEndpoint}/${encodeURIComponent(cardId)}`, {}, fetchFunction)
  const cardmarketPricing = card?.pricing?.cardmarket
  if (!cardmarketPricing || cardmarketPricing.unit !== 'EUR') {
    return null
  }
  return {
    source: 'tcgdex',
    sourceProductId: String(cardmarketPricing.idProduct),
    averageCents: euroFigureToCents(cardmarketPricing.avg),
    lowCents: euroFigureToCents(cardmarketPricing.low),
    trendCents: euroFigureToCents(cardmarketPricing.trend),
    average7DaysCents: euroFigureToCents(cardmarketPricing.avg7),
    average30DaysCents: euroFigureToCents(cardmarketPricing.avg30),
    observedAt: cardmarketPricing.updated,
  }
}
