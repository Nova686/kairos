import type { SourceAggregate } from '../../../src/price-sources/price-source-types.ts'
import { buildAggregateSnapshotDraft, type PriceSnapshotDraft } from './price-snapshot-drafts.ts'

export const buildCardReferenceSnapshotDrafts = (
  referenceAggregates: (SourceAggregate | null)[],
): PriceSnapshotDraft[] =>
  referenceAggregates
    .filter((aggregate): aggregate is SourceAggregate => aggregate !== null)
    .map(buildAggregateSnapshotDraft)
