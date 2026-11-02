import { conditionCodesFor, conditionLabel, type ConditionCode } from '../../shared/catalogue/condition-scale.ts'
import type { ProductCategory } from '../../shared/catalogue/product-category.ts'

export interface RetainedListingView {
  title: string
  priceCents: number
  shippingCents: number | null
  sourceCondition: string | null
  url: string
  imageUrl: string | null
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
  history: PriceHistoryPointView[]
  cardReferences: CardReferenceRowView[]
  lastRefreshedAt: string | null
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
  cells: (PriceOverviewCellView | null)[]
}

export interface PriceChartDataset {
  label: string
  data: (number | null)[]
  borderColor: string
  backgroundColor: string
  spanGaps: boolean
}

export interface PriceChartData {
  labels: string[]
  datasets: PriceChartDataset[]
}

const gradedConditionCode: ConditionCode = 'graded'
const fallbackConditionCode: ConditionCode = 'sealed-new'

const priceSourceRows: { source: string, label: string, color: string }[] = [
  { source: 'ebay', label: 'eBay', color: '#1e88e5' },
  { source: 'cardmarket', label: 'Cardmarket', color: '#43a047' },
  { source: 'vinted', label: 'Vinted', color: '#00897b' },
  { source: 'leboncoin', label: 'Leboncoin', color: '#fb8c00' },
  { source: 'other', label: 'Autre', color: '#8e24aa' },
]

export const cardReferenceSourceLabels: Record<string, string> = {
  tcgdex: 'TCGdex',
  pokemontcg: 'Pokémon TCG',
}

const parisDateFormatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatParisDate = (isoTimestamp: string): string => parisDateFormatter.format(new Date(isoTimestamp))

const gradedColumnKey =(gradingCompany: string, grade: string): string => `${gradedConditionCode}|${gradingCompany}|${grade}`

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
      columnsByKey.set(columnKeyOfCell(priceCell), {
        key: columnKeyOfCell(priceCell),
        label: `${priceCell.gradingCompany} ${priceCell.grade}`,
        condition: gradedConditionCode,
        gradingCompany: priceCell.gradingCompany,
        grade: priceCell.grade,
      })
    }
  }
  return [...columnsByKey.values()].sort(compareGradedColumns)
}

export const buildPriceRows = (cells: PriceOverviewCellView[], columns: PriceColumn[]): PriceRow[] =>
  priceSourceRows.map(({ source, label }) => ({
    source,
    label,
    cells: columns.map(column =>
      cells.find(priceCell => priceCell.source === source && columnKeyOfCell(priceCell) === column.key) ?? null),
  }))

export const buildHistoryChartData = (
  history: PriceHistoryPointView[],
  selectedColumn: PriceColumn | null,
): PriceChartData => {
  if (selectedColumn === null) {
    return { labels: [], datasets: [] }
  }
  const selectedPoints = history.filter(historyPoint => columnKeyOfCell(historyPoint) === selectedColumn.key)
  const labels = [...new Set(selectedPoints.map(historyPoint => historyPoint.observedOn))].sort()
  const datasets: PriceChartDataset[] = []
  for (const { source, label, color } of priceSourceRows) {
    const sourcePoints = selectedPoints.filter(historyPoint => historyPoint.source === source)
    if (sourcePoints.length > 0) {
      datasets.push({
        label,
        data: labels.map((observedOn) => {
          const matchingPoint = sourcePoints.find(historyPoint => historyPoint.observedOn === observedOn)
          return matchingPoint ? matchingPoint.figureCents / 100 : null
        }),
        borderColor: color,
        backgroundColor: color,
        spanGaps: true,
      })
    }
  }
  return { labels, datasets }
}

export const chooseDefaultColumnKey = (columns: PriceColumn[], preferredCondition: string | null): string | null => {
  const preferredColumn = columns.find(column => column.key === preferredCondition)
  if (preferredColumn) {
    return preferredColumn.key
  }
  const fallbackColumn = columns.find(column => column.key === fallbackConditionCode)
  return (fallbackColumn ?? columns[0])?.key ?? null
}
