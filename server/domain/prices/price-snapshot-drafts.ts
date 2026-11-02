import type { KairosDatabase } from '../../database/open-database.ts'
import { priceSnapshotListings, priceSnapshots } from '../../database/schema/index.ts'

export interface RetainedListingDraft {
  title: string
  priceCents: number
  shippingCents: number | null
  sourceCondition: string | null
  url: string
  imageUrl: string | null
}

export interface PriceSnapshotDraft {
  source: string
  kind: 'active' | 'source-aggregate'
  sourceCondition: string | null
  kairosCondition: string | null
  gradingCompany: string | null
  grade: string | null
  observedAt: Date
  averageCents: number | null
  medianCents: number | null
  lowCents: number | null
  trendCents: number | null
  listings: RetainedListingDraft[]
}

export const insertPriceSnapshotDrafts = async (
  database: KairosDatabase,
  productId: string,
  drafts: PriceSnapshotDraft[],
): Promise<string[]> => {
  const snapshotIds: string[] = []
  for (const draft of drafts) {
    const { listings, ...figures } = draft
    const [snapshot] = await database
      .insert(priceSnapshots)
      .values({ ...figures, productId, listingCount: listings.length })
      .returning({ id: priceSnapshots.id })
    snapshotIds.push(snapshot!.id)
    if (listings.length > 0) {
      await database.insert(priceSnapshotListings).values(listings.map(listing => ({ ...listing, snapshotId: snapshot!.id })))
    }
  }
  return snapshotIds
}
