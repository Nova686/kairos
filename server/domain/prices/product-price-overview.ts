import { eq, inArray } from 'drizzle-orm'
import type { ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import { isProductCategory, type ProductCategory } from '../../../shared/catalogue/product-category.ts'
import { conditionCodesFor } from '../../../shared/catalogue/condition-scale.ts'
import { estimateStockItemValue } from '../../../shared/valuation/estimate-stock-item-value.ts'
import { medianCents } from '../../../shared/valuation/median.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import { excludedListings, priceRefreshRequests, priceSnapshotListings, priceSnapshots, users } from '../../database/schema/index.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { normalizeListingUrl } from './record-ebay-snapshots.ts'
import { isSupersededEbaySnapshot } from './superseded-ebay-snapshots.ts'
import { parisCalendarDateOf } from './start-of-paris-day.ts'
import { loadValuationSnapshots } from '../valuation/load-valuation-snapshots.ts'

const millisecondsPerDay = 24 * 60 * 60 * 1000
const staleAfterMilliseconds = 7 * millisecondsPerDay
const historyWindowMilliseconds = 365 * millisecondsPerDay
const cardReferenceSources = ['tcgdex', 'pokemontcg']
const aggregateKind = 'source-aggregate'
const manualKind = 'manual'
const aggregateCondition: ConditionCode = 'sealed-new'
const manualEntryTitle = 'Prix saisi manuellement'

export interface RetainedListingView {
  title: string
  priceCents: number
  shippingCents: number | null
  sourceCondition: string | null
  url: string | null
  imageUrl: string | null
  observedAt: Date | null
  authorName: string | null
  isExcluded: boolean
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
  isStale: boolean
}

export interface RetainedValue {
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  valueCents: number | null
  approximate: boolean
  usedCondition: string | null
}

export interface ProductPriceOverview {
  retainedValues: RetainedValue[]
  bySourceAndCondition: PriceOverviewCell[]
  history: PriceHistoryPoint[]
  cardReferences: CardReferenceView[]
  lastRefreshedAt: Date | null
  excludedListingUrls: string[]
  isRefreshPending: boolean
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
  listedSnapshots: FiguredSnapshot[]
}

const summariseCell = (series: FiguredSnapshot[], now: Date): CellSummary => {
  const newest = series[series.length - 1]!
  if (newest.row.kind !== manualKind) {
    return { figureCents: newest.figureCents, listingCount: newest.row.listingCount, representative: newest, listedSnapshots: [newest] }
  }
  const freshEntries = series.filter(entry => !isStaleAt(entry.row.observedAt, now))
  if (freshEntries.length === 0) {
    return { figureCents: newest.figureCents, listingCount: newest.row.listingCount, representative: newest, listedSnapshots: [newest] }
  }
  return {
    figureCents: medianCents(freshEntries.map(entry => entry.figureCents))!,
    listingCount: freshEntries.length,
    representative: freshEntries[freshEntries.length - 1]!,
    listedSnapshots: [...freshEntries].reverse(),
  }
}

const loadListingsBySnapshot = async (
  database: KairosDatabase,
  snapshotIds: string[],
): Promise<Map<string, typeof priceSnapshotListings.$inferSelect[]>> => {
  const listingsBySnapshot = new Map<string, typeof priceSnapshotListings.$inferSelect[]>()
  if (snapshotIds.length === 0) {
    return listingsBySnapshot
  }
  const rows = await database.select().from(priceSnapshotListings).where(inArray(priceSnapshotListings.snapshotId, snapshotIds))
  for (const row of rows) {
    listingsBySnapshot.set(row.snapshotId, [...(listingsBySnapshot.get(row.snapshotId) ?? []), row])
  }
  return listingsBySnapshot
}

const loadAuthorNames = async (database: KairosDatabase, authorIds: string[]): Promise<Map<string, string>> => {
  if (authorIds.length === 0) {
    return new Map()
  }
  const rows = await database
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, authorIds))
  return new Map(rows.map(row => [row.id, row.displayName]))
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

const buildCardReferences = (rows: PriceSnapshotRow[], now: Date): CardReferenceView[] => {
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
    isStale: isStaleAt(row.observedAt, now),
  }))
}

const gradedCondition: ConditionCode = 'graded'

const compareGradedColumns = (left: RetainedValue, right: RetainedValue): number =>
  (left.gradingCompany ?? '').localeCompare(right.gradingCompany ?? '') || Number(right.grade) - Number(left.grade)

const buildRetainedValues = async (
  database: KairosDatabase,
  productId: string,
  category: ProductCategory | null,
  cells: PriceOverviewCell[],
  now: Date,
): Promise<RetainedValue[]> => {
  if (category === null) {
    return []
  }
  const snapshots = (await loadValuationSnapshots(database, [productId], now)).get(productId) ?? []
  const columns: Pick<RetainedValue, 'condition' | 'gradingCompany' | 'grade'>[] = category === 'graded-card'
    ? [...new Map(cells
        .filter(cell => cell.condition === gradedCondition && cell.gradingCompany !== null && cell.grade !== null)
        .map(cell => [`${cell.gradingCompany}|${cell.grade}`, { condition: gradedCondition, gradingCompany: cell.gradingCompany, grade: cell.grade }])).values()]
    : conditionCodesFor(category).map(condition => ({ condition, gradingCompany: null, grade: null }))
  const retainedValues = columns.map((column): RetainedValue => {
    const valuation = estimateStockItemValue({ category, ...column }, snapshots, now)
    return { ...column, valueCents: valuation.valueCents, approximate: valuation.approximate, usedCondition: valuation.usedCondition }
  })
  return category === 'graded-card' ? retainedValues.sort(compareGradedColumns) : retainedValues
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
  const [refreshRequest] = await database
    .select({
      lastRefreshedAt: priceRefreshRequests.lastRefreshedAt,
      lastEbayRefreshAt: priceRefreshRequests.lastEbayRefreshAt,
      requestedAt: priceRefreshRequests.requestedAt,
    })
    .from(priceRefreshRequests)
    .where(eq(priceRefreshRequests.productId, product.id))
  const lastEbayRefreshAt = refreshRequest?.lastEbayRefreshAt ?? undefined
  const seriesList = groupBySeries(figuredSnapshots)
  const cellSummaries = seriesList
    .map(series => summariseCell(series, now))
    .filter(summary => !isSupersededEbaySnapshot(summary.representative.row, lastEbayRefreshAt))
  const listedSnapshots = cellSummaries.flatMap(summary => summary.listedSnapshots)
  const listingsBySnapshot = await loadListingsBySnapshot(database, listedSnapshots.map(snapshot => snapshot.row.id))
  const authorIds = [...new Set(listedSnapshots.map(snapshot => snapshot.row.createdByUserId).filter((authorId): authorId is string => authorId !== null))]
  const authorNames = await loadAuthorNames(database, authorIds)
  const excludedUrlRows = await database
    .select({ url: excludedListings.url })
    .from(excludedListings)
    .where(eq(excludedListings.productId, product.id))
  const excludedListingUrls = excludedUrlRows.map(row => row.url).sort()
  const excludedUrlSet = new Set(excludedListingUrls)

  const listingsOfCell = (summary: CellSummary): RetainedListingView[] =>
    summary.listedSnapshots.flatMap((snapshot): RetainedListingView[] => {
      const storedListings = listingsBySnapshot.get(snapshot.row.id) ?? []
      if (snapshot.row.kind === manualKind) {
        return [{
          title: manualEntryTitle,
          priceCents: snapshot.figureCents,
          shippingCents: null,
          sourceCondition: null,
          url: storedListings[0]?.url ?? null,
          imageUrl: null,
          observedAt: snapshot.row.observedAt,
          authorName: snapshot.row.createdByUserId === null ? null : authorNames.get(snapshot.row.createdByUserId) ?? null,
          isExcluded: false,
        }]
      }
      return storedListings.map(stored => ({
        title: stored.title,
        priceCents: stored.priceCents,
        shippingCents: stored.shippingCents,
        sourceCondition: stored.sourceCondition,
        url: stored.url,
        imageUrl: stored.imageUrl,
        observedAt: null,
        authorName: null,
        isExcluded: excludedUrlSet.has(normalizeListingUrl(stored.url)),
      }))
    })

  const bySourceAndCondition: PriceOverviewCell[] = cellSummaries.map(summary => ({
    source: summary.representative.row.source,
    condition: summary.representative.condition,
    gradingCompany: summary.representative.row.gradingCompany,
    grade: summary.representative.row.grade,
    figureCents: summary.figureCents,
    listingCount: summary.listingCount,
    observedAt: summary.representative.row.observedAt,
    snapshotId: summary.representative.row.id,
    isStale: isStaleAt(summary.representative.row.observedAt, now),
    listings: listingsOfCell(summary),
  }))

  return {
    retainedValues: await buildRetainedValues(database, product.id, category, bySourceAndCondition, now),
    bySourceAndCondition,
    history: buildHistory(seriesList),
    cardReferences: buildCardReferences(recentRows, now),
    lastRefreshedAt: refreshRequest?.lastRefreshedAt ?? null,
    excludedListingUrls,
    isRefreshPending: (refreshRequest?.requestedAt ?? null) !== null,
  }
}
