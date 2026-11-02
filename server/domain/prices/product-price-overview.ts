import { eq, inArray } from 'drizzle-orm'
import type { ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import { isProductCategory, type ProductCategory } from '../../../shared/catalogue/product-category.ts'
import { medianCents } from '../../../shared/valuation/median.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import { priceRefreshRequests, priceSnapshotListings, priceSnapshots } from '../../database/schema/index.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { parisCalendarDateOf } from './start-of-paris-day.ts'

const millisecondsPerDay = 24 * 60 * 60 * 1000
const staleAfterMilliseconds = 7 * millisecondsPerDay
const historyWindowMilliseconds = 365 * millisecondsPerDay
const cardReferenceSources = ['tcgdex', 'pokemontcg']
const aggregateKind = 'source-aggregate'
const manualKind = 'manual'
const aggregateCondition: ConditionCode = 'sealed-new'

export interface RetainedListingView {
  title: string
  priceCents: number
  shippingCents: number | null
  sourceCondition: string | null
  url: string
  imageUrl: string | null
}

export interface PriceOverviewCell {
  source: string
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  figureCents: number
  listingCount: number
  observedAt: Date
  snapshotId: string
  isStale: boolean
  listings: RetainedListingView[]
}

export interface PriceHistoryPoint {
  source: string
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  observedOn: string
  figureCents: number
}

export interface CardReferenceView {
  source: string
  averageCents: number | null
  trendCents: number | null
  lowCents: number | null
  observedAt: Date
  snapshotId: string
}

export interface ProductPriceOverview {
  bySourceAndCondition: PriceOverviewCell[]
  history: PriceHistoryPoint[]
  cardReferences: CardReferenceView[]
  lastRefreshedAt: Date | null
}

type PriceSnapshotRow = typeof priceSnapshots.$inferSelect

interface FiguredSnapshot {
  row: PriceSnapshotRow
  condition: ConditionCode
  figureCents: number
}

const figureOf = (row: PriceSnapshotRow): number | null =>
  row.kind === aggregateKind
    ? row.averageCents ?? row.trendCents ?? row.lowCents
    : row.medianCents

const conditionOf = (row: PriceSnapshotRow, category: ProductCategory | null): ConditionCode | null => {
  if (row.kind === aggregateKind) {
    return category === 'pokemon-sealed' ? aggregateCondition : null
  }
  return row.kairosCondition as ConditionCode | null
}

const seriesKeyOf = (snapshot: FiguredSnapshot): string =>
  [snapshot.row.source, snapshot.condition, snapshot.row.gradingCompany ?? '', snapshot.row.grade ?? ''].join('|')

const byObservedAtAscending = (left: FiguredSnapshot, right: FiguredSnapshot): number =>
  left.row.observedAt.getTime() - right.row.observedAt.getTime()

const isStaleAt = (observedAt: Date, now: Date): boolean => now.getTime() - observedAt.getTime() > staleAfterMilliseconds

const groupBySeries = (snapshots: FiguredSnapshot[]): FiguredSnapshot[][] => {
  const groups = new Map<string, FiguredSnapshot[]>()
  for (const snapshot of snapshots) {
    const key = seriesKeyOf(snapshot)
    groups.set(key, [...(groups.get(key) ?? []), snapshot])
  }
  return [...groups.values()].map(group => [...group].sort(byObservedAtAscending))
}

interface CellSummary {
  figureCents: number
  listingCount: number
  representative: FiguredSnapshot
}

const summariseCell = (series: FiguredSnapshot[], now: Date): CellSummary => {
  const newest = series[series.length - 1]!
  if (newest.row.kind !== manualKind) {
    return { figureCents: newest.figureCents, listingCount: newest.row.listingCount, representative: newest }
  }
  const freshEntries = series.filter(entry => !isStaleAt(entry.row.observedAt, now))
  if (freshEntries.length === 0) {
    return { figureCents: newest.figureCents, listingCount: newest.row.listingCount, representative: newest }
  }
  return {
    figureCents: medianCents(freshEntries.map(entry => entry.figureCents))!,
    listingCount: freshEntries.length,
    representative: freshEntries[freshEntries.length - 1]!,
  }
}

const loadListingsBySnapshot = async (
  database: KairosDatabase,
  snapshotIds: string[],
): Promise<Map<string, RetainedListingView[]>> => {
  const listingsBySnapshot = new Map<string, RetainedListingView[]>()
  if (snapshotIds.length === 0) {
    return listingsBySnapshot
  }
  const rows = await database.select().from(priceSnapshotListings).where(inArray(priceSnapshotListings.snapshotId, snapshotIds))
  for (const row of rows) {
    const listing: RetainedListingView = {
      title: row.title,
      priceCents: row.priceCents,
      shippingCents: row.shippingCents,
      sourceCondition: row.sourceCondition,
      url: row.url,
      imageUrl: row.imageUrl,
    }
    listingsBySnapshot.set(row.snapshotId, [...(listingsBySnapshot.get(row.snapshotId) ?? []), listing])
  }
  return listingsBySnapshot
}

const buildHistory = (seriesList: FiguredSnapshot[][]): PriceHistoryPoint[] => {
  const points: PriceHistoryPoint[] = []
  for (const series of seriesList) {
    const lastSnapshotByDay = new Map<string, FiguredSnapshot>()
    for (const snapshot of series) {
      lastSnapshotByDay.set(parisCalendarDateOf(snapshot.row.observedAt), snapshot)
    }
    for (const [observedOn, snapshot] of lastSnapshotByDay) {
      points.push({
        source: snapshot.row.source,
        condition: snapshot.condition,
        gradingCompany: snapshot.row.gradingCompany,
        grade: snapshot.row.grade,
        observedOn,
        figureCents: snapshot.figureCents,
      })
    }
  }
  return points.sort((left, right) => left.observedOn.localeCompare(right.observedOn))
}

const buildCardReferences = (rows: PriceSnapshotRow[]): CardReferenceView[] => {
  const newestBySource = new Map<string, PriceSnapshotRow>()
  for (const row of rows.filter(candidate => cardReferenceSources.includes(candidate.source))) {
    const known = newestBySource.get(row.source)
    if (!known || known.observedAt.getTime() < row.observedAt.getTime()) {
      newestBySource.set(row.source, row)
    }
  }
  return [...newestBySource.values()].map(row => ({
    source: row.source,
    averageCents: row.averageCents,
    trendCents: row.trendCents,
    lowCents: row.lowCents,
    observedAt: row.observedAt,
    snapshotId: row.id,
  }))
}

export const productPriceOverview = async (
  database: KairosDatabase,
  productId: string,
  now: Date,
): Promise<ProductPriceOverview> => {
  const product = await findProductOr404(database, productId)
  const category = isProductCategory(product.category) ? product.category : null
  const rows = await database
    .select()
    .from(priceSnapshots)
    .where(eq(priceSnapshots.productId, product.id))
  const recentRows = rows.filter(row => row.observedAt.getTime() >= now.getTime() - historyWindowMilliseconds)

  const figuredSnapshots: FiguredSnapshot[] = []
  for (const row of recentRows) {
    const figureCents = figureOf(row)
    const condition = conditionOf(row, category)
    if (figureCents !== null && condition !== null && !cardReferenceSources.includes(row.source)) {
      figuredSnapshots.push({ row, condition, figureCents })
    }
  }
  const seriesList = groupBySeries(figuredSnapshots)
  const cellSummaries = seriesList.map(series => summariseCell(series, now))
  const listingsBySnapshot = await loadListingsBySnapshot(database, cellSummaries.map(summary => summary.representative.row.id))

  const bySourceAndCondition: PriceOverviewCell[] = cellSummaries.map(({ figureCents, listingCount, representative }) => ({
    source: representative.row.source,
    condition: representative.condition,
    gradingCompany: representative.row.gradingCompany,
    grade: representative.row.grade,
    figureCents,
    listingCount,
    observedAt: representative.row.observedAt,
    snapshotId: representative.row.id,
    isStale: isStaleAt(representative.row.observedAt, now),
    listings: listingsBySnapshot.get(representative.row.id) ?? [],
  }))

  const [refreshRequest] = await database
    .select({ lastRefreshedAt: priceRefreshRequests.lastRefreshedAt })
    .from(priceRefreshRequests)
    .where(eq(priceRefreshRequests.productId, product.id))

  return {
    bySourceAndCondition,
    history: buildHistory(seriesList),
    cardReferences: buildCardReferences(recentRows),
    lastRefreshedAt: refreshRequest?.lastRefreshedAt ?? null,
  }
}
