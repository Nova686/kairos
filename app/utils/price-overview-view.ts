import { conditionCodesFor, conditionLabel, type ConditionCode } from '../../shared/catalogue/condition-scale.ts'
import type { ProductCategory } from '../../shared/catalogue/product-category.ts'
import { canonicalCompanyName } from '~~/shared/prices/grading-company.ts'

export interface RetainedListingView {
  title: string
  priceCents: number
  shippingCents: number | null
  sourceCondition: string | null
  url: string | null
  imageUrl: string | null
  observedAt: string | null
  authorName: string | null
  isExcluded: boolean
}

export interface PriceOverviewCellView {
  source: string
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  figureCents: number
  listingCount: number
  observedAt: string
  snapshotId: string
  isStale: boolean
  listings: RetainedListingView[]
}

export interface PriceHistoryPointView {
  source: string
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  observedOn: string
  figureCents: number
}

export interface CardReferenceRowView {
  source: string
  averageCents: number | null
  trendCents: number | null
  lowCents: number | null
  observedAt: string
  snapshotId: string
}

export interface ProductPriceOverviewView {
  bySourceAndCondition: PriceOverviewCellView[]
  retainedValues: RetainedValueView[]
  history: PriceHistoryPointView[]
  cardReferences: CardReferenceRowView[]
  lastRefreshedAt: string | null
  excludedListingUrls: string[]
  isRefreshPending: boolean
}

export interface PriceColumn {
  key: string
  label: string
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
}

export interface PriceRow {
  source: string
  label: string
  color: string
  cells: (PriceOverviewCellView | null)[]
}

export interface RetainedValueView {
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  valueCents: number | null
  approximate: boolean
  usedCondition: string | null
}

export interface PriceChartPoint {
  x: number
  y: number
}

export interface PriceChartDataset {
  label: string
  data: PriceChartPoint[]
  borderColor: string
  backgroundColor: string
  spanGaps: boolean
  isDashed?: boolean
  hasAreaFill?: boolean
}

export interface PriceChartData {
  datasets: PriceChartDataset[]
}

const gradedConditionCode: ConditionCode = 'graded'
const fallbackConditionCode: ConditionCode = 'sealed-new'

const priceSourceRows: { source: string, label: string, color: string }[] = [
  { source: 'ebay', label: 'eBay', color: '#6fa8dc' },
  { source: 'cardmarket', label: 'Cardmarket', color: '#4cc38a' },
  { source: 'vinted', label: 'Vinted', color: '#a993f0' },
  { source: 'leboncoin', label: 'Leboncoin', color: '#e3a44a' },
  { source: 'other', label: 'Autre', color: '#5fd1c1' },
]

export const cardReferenceSourceLabels: Record<string, string> = {
  tcgdex: 'TCGdex',
  pokemontcg: 'Pokémon TCG',
}

const parisDateFormatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatParisDate = (isoTimestamp: string): string => parisDateFormatter.format(new Date(isoTimestamp))

const parisDateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const formatParisDateTime = (isoTimestamp: string): string => parisDateTimeFormatter.format(new Date(isoTimestamp))

const collapseSpaces = (text: string): string => text.trim().replace(/\s+/g, ' ')

export const gradedColumnKey = (gradingCompany: string, grade: string): string =>
  `${gradedConditionCode}|${canonicalCompanyName(gradingCompany).toUpperCase()}|${collapseSpaces(grade)}`

const columnKeyOfCell = (priceCell: { condition: ConditionCode, gradingCompany: string | null, grade: string | null }): string =>
  priceCell.condition === gradedConditionCode
    ? gradedColumnKey(priceCell.gradingCompany ?? '', priceCell.grade ?? '')
    : priceCell.condition

const compareGradedColumns = (left: PriceColumn, right: PriceColumn): number =>
  (left.gradingCompany ?? '').localeCompare(right.gradingCompany ?? '') || Number(right.grade) - Number(left.grade)

export const buildPriceColumns = (category: ProductCategory, cells: PriceOverviewCellView[]): PriceColumn[] => {
  if (category !== 'graded-card') {
    return conditionCodesFor(category).map(condition => ({
      key: condition,
      label: conditionLabel(condition),
      condition,
      gradingCompany: null,
      grade: null,
    }))
  }
  const columnsByKey = new Map<string, PriceColumn>()
  for (const priceCell of cells) {
    if (priceCell.condition === gradedConditionCode && priceCell.gradingCompany !== null && priceCell.grade !== null) {
      const gradingCompany = canonicalCompanyName(priceCell.gradingCompany)
      const grade = collapseSpaces(priceCell.grade)
      columnsByKey.set(columnKeyOfCell(priceCell), {
        key: columnKeyOfCell(priceCell),
        label: `${gradingCompany} ${grade}`,
        condition: gradedConditionCode,
        gradingCompany,
        grade,
      })
    }
  }
  return [...columnsByKey.values()].sort(compareGradedColumns)
}

const latestObservedCell = (latest: PriceOverviewCellView | null, candidate: PriceOverviewCellView): PriceOverviewCellView =>
  latest === null || Date.parse(candidate.observedAt) > Date.parse(latest.observedAt) ? candidate : latest

export const buildPriceRows = (cells: PriceOverviewCellView[], columns: PriceColumn[]): PriceRow[] =>
  priceSourceRows.map(({ source, label, color }) => ({
    source,
    label,
    color,
    cells: columns.map(column =>
      cells
        .filter(priceCell => priceCell.source === source && columnKeyOfCell(priceCell) === column.key)
        .reduce<PriceOverviewCellView | null>(latestObservedCell, null)),
  }))

export const findRetainedValue = (retainedValues: RetainedValueView[], column: PriceColumn | null): RetainedValueView | null =>
  column === null ? null : retainedValues.find(retainedValue => columnKeyOfCell(retainedValue) === column.key) ?? null

export const findRetainedCellSnapshotId = (
  rows: PriceRow[],
  columnIndex: number,
  retainedValue: RetainedValueView | null,
): string | null => {
  if (retainedValue === null || retainedValue.valueCents === null || retainedValue.approximate) {
    return null
  }
  const retainedCents = retainedValue.valueCents
  const freshCells = rows
    .map(row => row.cells[columnIndex])
    .filter((priceCell): priceCell is PriceOverviewCellView => priceCell !== undefined && priceCell !== null && !priceCell.isStale)
  const closestCell = freshCells.reduce<PriceOverviewCellView | null>((closest, candidate) =>
    closest === null || Math.abs(candidate.figureCents - retainedCents) < Math.abs(closest.figureCents - retainedCents) ? candidate : closest, null)
  return closestCell?.snapshotId ?? null
}

const millisecondsPerDay =24 * 60 * 60 * 1000

export const dayNumberOf = (calendarDate: string): number => Date.parse(`${calendarDate}T00:00:00Z`) / millisecondsPerDay

const dayNumberFormatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatDayNumber = (dayNumber: number): string => dayNumberFormatter.format(new Date(dayNumber * millisecondsPerDay))

export const buildHistoryChartData = (
  history: PriceHistoryPointView[],
  selectedColumn: PriceColumn | null,
): PriceChartData => {
  if (selectedColumn === null) {
    return { datasets: [] }
  }
  const selectedPoints = history.filter(historyPoint => columnKeyOfCell(historyPoint) === selectedColumn.key)
  const datasets: PriceChartDataset[] = []
  for (const { source, label, color } of priceSourceRows) {
    const sourcePoints = selectedPoints
      .filter(historyPoint => historyPoint.source === source)
      .sort((left, right) => left.observedOn.localeCompare(right.observedOn))
    if (sourcePoints.length > 0) {
      datasets.push({
        label,
        data: sourcePoints.map(historyPoint => ({ x: dayNumberOf(historyPoint.observedOn), y: historyPoint.figureCents / 100 })),
        borderColor: color,
        backgroundColor: color,
        spanGaps: false,
      })
    }
  }
  return { datasets }
}

export const chooseDefaultColumnKey = (columns: PriceColumn[], preferredCondition: string | null): string | null => {
  const preferredColumn = columns.find(column => column.key === preferredCondition)
  if (preferredColumn) {
    return preferredColumn.key
  }
  const fallbackColumn = columns.find(column => column.key === fallbackConditionCode)
  return (fallbackColumn ?? columns[0])?.key ?? null
}

const minimumChartDayCount = 2

export const curveNeedsTwoDaysMessage = 'La courbe apparaîtra après deux jours de relevés.'

export const hasEnoughDaysToDrawCurve = (chartData: PriceChartData): boolean => {
  const distinctDayNumbers = new Set<number>()
  for (const dataset of chartData.datasets) {
    for (const point of dataset.data) {
      distinctDayNumbers.add(point.x)
    }
  }
  return distinctDayNumbers.size >= minimumChartDayCount
}
