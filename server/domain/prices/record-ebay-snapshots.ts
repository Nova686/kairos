import { resolveKairosConditionWithCompiledRules } from '../../../shared/prices/resolve-kairos-condition.ts'
import type { CompiledTitleRules, ConditionMappingEntry } from '../../../shared/prices/resolve-kairos-condition.ts'
import { parseGradeFromTitle } from '../../../shared/prices/parse-grade-from-title.ts'
import { medianCents } from '../../../shared/valuation/median.ts'
import { removeOutliers } from '../../../shared/valuation/remove-outliers.ts'
import type { ListingObservation } from '../../../src/price-sources/price-source-types.ts'
import type { PriceSnapshotDraft, RetainedListingDraft } from './price-snapshot-drafts.ts'

export interface EbaySnapshotContext {
  category: string
  excludedKeywords: string[]
  excludedUrls: Set<string>
  mappings: ConditionMappingEntry[]
  compiledRules: CompiledTitleRules
  observedAt: Date
}

interface ListingGroup {
  kairosCondition: string
  gradingCompany: string | null
  grade: string | null
  listings: ListingObservation[]
}

const gradedCategory = 'graded-card'
const gradedCondition = 'graded'

const foldForComparison = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export const normalizeListingUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url)
    return `${parsedUrl.origin}${parsedUrl.pathname}`
  }
  catch {
    return url
  }
}

const containsExcludedKeyword = (title: string, foldedKeywords: string[]): boolean => {
  const foldedTitle = foldForComparison(title)
  return foldedKeywords.some(keyword => foldedTitle.includes(keyword))
}

const groupByCondition = (listings: ListingObservation[], context: EbaySnapshotContext): ListingGroup[] => {
  const groups = new Map<string, ListingGroup>()
  for (const listing of listings) {
    const grade = context.category === gradedCategory ? parseGradeFromTitle(listing.title) : null
    const kairosCondition = context.category === gradedCategory
      ? (grade ? gradedCondition : null)
      : resolveKairosConditionWithCompiledRules(context.mappings, context.compiledRules, {
          category: context.category,
          source: 'ebay',
          sourceCondition: listing.sourceCondition,
          title: listing.title,
        })
    if (kairosCondition === null) continue
    const groupKey = [kairosCondition, grade?.gradingCompany ?? '', grade?.grade ?? ''].join('|')
    const group = groups.get(groupKey) ?? {
      kairosCondition,
      gradingCompany: grade?.gradingCompany ?? null,
      grade: grade?.grade ?? null,
      listings: [],
    }
    group.listings.push(listing)
    groups.set(groupKey, group)
  }
  return [...groups.values()]
}

const retainWithoutOutliers = (listings: ListingObservation[]): ListingObservation[] => {
  const retainedPrices = removeOutliers(listings.map(listing => listing.priceCents))
  const lowestRetained = Math.min(...retainedPrices)
  const highestRetained = Math.max(...retainedPrices)
  return listings.filter(listing => listing.priceCents >= lowestRetained && listing.priceCents <= highestRetained)
}

const toRetainedListingDraft = (listing: ListingObservation): RetainedListingDraft => ({
  title: listing.title,
  priceCents: listing.priceCents,
  shippingCents: listing.shippingCents,
  sourceCondition: listing.sourceCondition,
  url: listing.url,
  imageUrl: listing.imageUrl,
})

export const buildEbaySnapshotDrafts = (
  listings: ListingObservation[],
  context: EbaySnapshotContext,
): PriceSnapshotDraft[] => {
  const foldedKeywords = context.excludedKeywords.map(foldForComparison).filter(keyword => keyword.length > 0)
  const candidateListings = listings.filter(listing =>
    !context.excludedUrls.has(normalizeListingUrl(listing.url)) && !containsExcludedKeyword(listing.title, foldedKeywords))
  const drafts: PriceSnapshotDraft[] = []
  for (const group of groupByCondition(candidateListings, context)) {
    const retained = retainWithoutOutliers(group.listings)
    const retainedPrices = retained.map(listing => listing.priceCents)
    drafts.push({
      source: 'ebay',
      kind: 'active',
      sourceCondition: null,
      kairosCondition: group.kairosCondition,
      gradingCompany: group.gradingCompany,
      grade: group.grade,
      observedAt: context.observedAt,
      averageCents: Math.round(retainedPrices.reduce((sum, price) => sum + price, 0) / retainedPrices.length),
      medianCents: medianCents(retainedPrices),
      lowCents: Math.min(...retainedPrices),
      trendCents: null,
      listings: retained.map(toRetainedListingDraft),
    })
  }
  return drafts
}
