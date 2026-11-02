export type PriceSourceId = 'ebay' | 'cardmarket' | 'tcgdex' | 'pokemontcg' | 'vinted' | 'leboncoin'

export type SourceId = PriceSourceId | 'psa' | 'openbeautyfacts' | 'upcitemdb'

export type ListingKind = 'active' | 'sold' | 'source-aggregate' | 'manual'

export interface ListingObservation {
  source: PriceSourceId
  kind: ListingKind
  title: string
  priceCents: number
  shippingCents: number | null
  sourceCondition: string | null
  url: string
  imageUrl: string | null
}

export interface PriceSourceAdapter {
  id: PriceSourceId
  supportedKinds: ListingKind[]
  search(query: string, kind: ListingKind): Promise<ListingObservation[]>
}

export class SourceBlockedError extends Error {
  readonly source: SourceId
  readonly reason: string

  constructor(source: SourceId, reason: string) {
    super(`${source} blocked the request: ${reason}`)
    this.name = 'SourceBlockedError'
    this.source = source
    this.reason = reason
  }
}

export class SourceDisabledError extends Error {
  readonly source: SourceId
  readonly missingSetting: string

  constructor(source: SourceId, missingSetting: string) {
    super(`${source} is disabled: ${missingSetting} is not set`)
    this.name = 'SourceDisabledError'
    this.source = source
    this.missingSetting = missingSetting
  }
}

export const deduplicateByUrl = (observations: ListingObservation[]): ListingObservation[] => {
  const seenUrls = new Set<string>()
  return observations.filter((observation) => {
    if (seenUrls.has(observation.url)) {
      return false
    }
    seenUrls.add(observation.url)
    return true
  })
}
