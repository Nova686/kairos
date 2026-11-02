export type PriceSourceId = 'ebay' | 'vinted' | 'leboncoin' | 'cardmarket'

export type ListingKind = 'active' | 'sold'

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
  readonly source: PriceSourceId
  readonly reason: string

  constructor(source: PriceSourceId, reason: string) {
    super(`${source} blocked the request: ${reason}`)
    this.name = 'SourceBlockedError'
    this.source = source
    this.reason = reason
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
