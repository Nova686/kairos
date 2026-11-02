import { deduplicateByUrl } from '../price-source-types.ts'
import type { ListingObservation } from '../price-source-types.ts'

interface EbayAmount {
  value: string
  currency: string
}

interface EbayItemSummary {
  title: string
  price?: EbayAmount
  condition?: string
  itemWebUrl: string
  image?: { imageUrl?: string }
  shippingOptions?: { shippingCost?: EbayAmount }[]
  itemGroupType?: string
  itemGroupHref?: string
}

const hasVariations = (itemSummary: EbayItemSummary): boolean =>
  Boolean(itemSummary.itemGroupType || itemSummary.itemGroupHref)

const euroAmountToCents = (amount: EbayAmount | undefined): number | null => {
  if (!amount || amount.currency !== 'EUR') {
    return null
  }
  const euros = Number(amount.value)
  return Number.isFinite(euros) && euros >= 0 ? Math.round(euros * 100) : null
}

export const parseEbayItemSummaries = (rawSearch: unknown): ListingObservation[] => {
  const itemSummaries = (rawSearch as { itemSummaries?: EbayItemSummary[] }).itemSummaries ?? []
  const observations: ListingObservation[] = []
  for (const itemSummary of itemSummaries) {
    const priceCents = euroAmountToCents(itemSummary.price)
    if (priceCents === null || priceCents === 0 || hasVariations(itemSummary)) {
      continue
    }
    observations.push({
      source: 'ebay',
      kind: 'active',
      title: itemSummary.title,
      priceCents,
      shippingCents: euroAmountToCents(itemSummary.shippingOptions?.[0]?.shippingCost),
      sourceCondition: itemSummary.condition ?? null,
      url: itemSummary.itemWebUrl,
      imageUrl: itemSummary.image?.imageUrl ?? null,
    })
  }
  return deduplicateByUrl(observations)
}
