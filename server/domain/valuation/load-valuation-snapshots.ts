import { and, gte, inArray } from 'drizzle-orm'
import type { ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import type { ValuationSnapshot, ValuationSnapshotKind } from '../../../shared/valuation/estimate-stock-item-value.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import { priceSnapshots } from '../../database/schema/index.ts'
import { isSupersededEbaySnapshot, loadLastEbayRefreshes } from '../prices/superseded-ebay-snapshots.ts'

const freshnessWindowMilliseconds = 7 * 24 * 60 * 60 * 1000

type PriceSnapshotRow = typeof priceSnapshots.$inferSelect

const figureOf = (row: PriceSnapshotRow): number | null =>
  row.kind === 'source-aggregate'
    ? row.averageCents ?? row.trendCents ?? row.lowCents
    : row.medianCents

export const loadValuationSnapshots = async (
  database: KairosDatabase,
  productIds: string[],
  now: Date,
): Promise<Map<string, ValuationSnapshot[]>> => {
  const snapshotsByProduct = new Map<string, ValuationSnapshot[]>(productIds.map(productId => [productId, []]))
  if (productIds.length === 0) {
    return snapshotsByProduct
  }
  const rows = await database
    .select()
    .from(priceSnapshots)
    .where(and(
      inArray(priceSnapshots.productId, productIds),
      gte(priceSnapshots.observedAt, new Date(now.getTime() - freshnessWindowMilliseconds)),
    ))
  const lastEbayRefreshes = await loadLastEbayRefreshes(database, productIds)
  for (const row of rows.filter(candidate => !isSupersededEbaySnapshot(candidate, lastEbayRefreshes.get(candidate.productId)))) {
    snapshotsByProduct.get(row.productId)!.push({
      source: row.source,
      kind: row.kind as ValuationSnapshotKind,
      kairosCondition: row.kairosCondition as ConditionCode | null,
      gradingCompany: row.gradingCompany,
      grade: row.grade,
      observedAt: row.observedAt,
      figureCents: figureOf(row),
    })
  }
  return snapshotsByProduct
}
