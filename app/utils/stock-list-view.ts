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

export const summarizeHeldStock = (rows: StockListSortableRow[]) => {
  const heldRows = rows.filter(row => row.valueDescription.state !== 'not-applicable')
  return {
    heldCount: heldRows.length,
    unpricedCount: heldRows.filter(row => row.valueDescription.state === 'no-price').length,
    investedCents: heldRows.reduce((total, row) => total + row.purchasePriceCents, 0),
    valuedCents: heldRows.reduce((total, row) => total + (row.valueCents ?? 0), 0),
  }
}

export const describeConditionChipTone = (category: string): ConditionChipTone => {
  if (category === 'pokemon-sealed') {
    return 'primary'
  }
  return category === 'graded-card' ? 'accent' : 'neutral'
}
