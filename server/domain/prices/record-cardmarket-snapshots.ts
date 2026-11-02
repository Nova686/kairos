import type { SourceAggregate } from '../../../src/price-sources/price-source-types.ts'
import type { PriceSnapshotDraft } from './price-snapshot-drafts.ts'

export const buildAggregateSnapshotDraft = (aggregate: SourceAggregate): PriceSnapshotDraft => ({
  source: aggregate.source,
  kind: 'source-aggregate',
  sourceCondition: null,
  kairosCondition: null,
  gradingCompany: null,
  grade: null,
  observedAt: new Date(aggregate.observedAt),
  averageCents: aggregate.averageCents,
  medianCents: null,
  lowCents: aggregate.lowCents,
  trendCents: aggregate.trendCents,
  listings: [],
})

export const buildCardmarketSnapshotDrafts = (
  cardmarketProductId: number | null,
  aggregatesByProduct: Map<number, SourceAggregate>,
): PriceSnapshotDraft[] => {
  const aggregate = cardmarketProductId === null ? undefined : aggregatesByProduct.get(cardmarketProductId)
  return aggregate ? [buildAggregateSnapshotDraft(aggregate)] : []
}
