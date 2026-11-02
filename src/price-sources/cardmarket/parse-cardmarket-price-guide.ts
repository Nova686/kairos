import { euroFigureToCents } from '../price-source-types.ts'
import type { SourceAggregate } from '../price-source-types.ts'

interface CardmarketPriceGuideEntry {
  idProduct: number
  avg: number | null
  low: number | null
  trend: number | null
  avg7: number | null
  avg30: number | null
}

export const parseCardmarketPriceGuide = (rawGuide: unknown, observedAt: string): Map<number, SourceAggregate> => {
  const guideEntries = (rawGuide as { priceGuides?: CardmarketPriceGuideEntry[] }).priceGuides ?? []
  const aggregatesByProduct = new Map<number, SourceAggregate>()
  for (const guideEntry of guideEntries) {
    const aggregate: SourceAggregate = {
      source: 'cardmarket',
      sourceProductId: String(guideEntry.idProduct),
      averageCents: euroFigureToCents(guideEntry.avg),
      lowCents: euroFigureToCents(guideEntry.low),
      trendCents: euroFigureToCents(guideEntry.trend),
      average7DaysCents: euroFigureToCents(guideEntry.avg7),
      average30DaysCents: euroFigureToCents(guideEntry.avg30),
      observedAt,
    }
    if (aggregate.averageCents === null && aggregate.lowCents === null && aggregate.trendCents === null) {
      continue
    }
    aggregatesByProduct.set(guideEntry.idProduct, aggregate)
  }
  return aggregatesByProduct
}
