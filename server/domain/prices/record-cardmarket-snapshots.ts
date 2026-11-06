import type { SourceAggregate } from '../../../src/price-sources/price-source-types.ts'
import { buildAggregateSnapshotDraft, type PriceSnapshotDraft } from './price-snapshot-drafts.ts'

export const buildCardmarketSnapshotDrafts = (
  cardmarketProductId: number | null,
  aggregatesByProduct: Map<number, SourceAggregate>,
): PriceSnapshotDraft[] => {
  const aggregate = cardmarketProductId === null ? undefined : aggregatesByProduct.get(cardmarketProductId)
  return aggregate ? [buildAggregateSnapshotDraft(aggregate)] : []
}
