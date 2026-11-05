import { stockItemStatusLabels, type StockItemStatus } from '../../shared/stock/stock-item-status.ts'
import { formatEuros } from './format-euros.ts'
import { pluralizeFrench } from './pluralize-french.ts'
import type { StockItemValueDescription } from './stock-value-view.ts'

export type StockSortKey = 'recent' | 'gain' | 'value' | 'name'

export const stockSortOptions: { value: StockSortKey, title: string }[] = [
  { value: 'recent', title: 'Ordre d’ajout' },
  { value: 'gain', title: 'Plus-value' },
  { value: 'value', title: 'Valeur estimée' },
  { value: 'name', title: 'Nom' },
]

export interface StockListSortableRow {
  productName: string
  purchasePriceCents: number
  valueCents: number | null
  gainCents: number | null
  valueDescription: StockItemValueDescription
}

export type ConditionChipTone = 'primary' | 'accent' | 'neutral'

const compareDescendingNullsLast = (left: number | null, right: number | null): number => {
  if (left === null || right === null) {
    return Number(left === null) - Number(right === null)
  }
  return right - left
}

const stockSortComparators: Record<StockSortKey, (left: StockListSortableRow, right: StockListSortableRow) => number> = {
  recent: () => 0,
  gain: (left, right) => compareDescendingNullsLast(left.gainCents, right.gainCents),
  value: (left, right) => compareDescendingNullsLast(left.valueCents, right.valueCents),
  name: (left, right) => left.productName.localeCompare(right.productName, 'fr'),
}

export const sortStockListRows = <Row extends StockListSortableRow>(rows: Row[], sortKey: StockSortKey): Row[] =>
  [...rows].sort(stockSortComparators[sortKey])

export interface HeldStockSummary {
  heldCount: number
  unpricedCount: number
  valuedCostCents: number
  valuedCents: number
}

export const summarizeHeldStock = (rows: StockListSortableRow[]): HeldStockSummary => {
  const heldRows = rows.filter(row => row.valueDescription.state !== 'not-applicable')
  const pricedRows = heldRows.filter(row => row.valueCents !== null)
  return {
    heldCount: heldRows.length,
    unpricedCount: heldRows.filter(row => row.valueDescription.state === 'no-price').length,
    valuedCostCents: pricedRows.reduce((total, row) => total + row.purchasePriceCents, 0),
    valuedCents: pricedRows.reduce((total, row) => total + (row.valueCents ?? 0), 0),
  }
}

export const describeHeldStockSubtitle = (summary: HeldStockSummary): string => {
  const subtitleParts = [
    pluralizeFrench(summary.heldCount, 'exemplaire'),
    `valeur ${formatEuros(summary.valuedCents)} pour ${formatEuros(summary.valuedCostCents)} investis`,
  ]
  if (summary.unpricedCount > 0) {
    subtitleParts.push(`${summary.unpricedCount} sans prix, ${summary.unpricedCount > 1 ? 'non comptés' : 'non compté'}`)
  }
  return subtitleParts.join(' · ')
}

export const describeStockCardStatus = (status: StockItemStatus): string | null =>
  status === 'in-stock' ? null : stockItemStatusLabels[status]

export const describeConditionChipTone = (category: string): ConditionChipTone => {
  if (category === 'pokemon-sealed') {
    return 'primary'
  }
  return category === 'graded-card' ? 'accent' : 'neutral'
}
