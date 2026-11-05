import { heldStockItemStatuses } from '../../shared/stock/stock-item-status.ts'
import type { StockItemRow } from '../../shared/stock/stock-item-row.ts'

export interface ProductHoldingsSummary {
  heldCount: number
  heldInColumnCount: number
  averagePurchaseCents: number | null
}

export const columnKeyOfStockItem = (stockItem: Pick<StockItemRow, 'condition' | 'gradingCompany' | 'grade'>): string =>
  stockItem.gradingCompany !== null && stockItem.grade !== null
    ? `graded|${stockItem.gradingCompany}|${stockItem.grade}`
    : stockItem.condition

export const summarizeProductHoldings = (
  stockItems: StockItemRow[],
  productId: string,
  columnKey: string | null,
): ProductHoldingsSummary => {
  const heldItems = stockItems.filter(stockItem =>
    stockItem.productId === productId && heldStockItemStatuses.includes(stockItem.status))
  const heldInColumn = columnKey === null
    ? []
    : heldItems.filter(stockItem => columnKeyOfStockItem(stockItem) === columnKey)
  const totalPurchaseCents = heldInColumn.reduce((total, stockItem) => total + stockItem.allocatedPurchaseCents, 0)
  return {
    heldCount: heldItems.length,
    heldInColumnCount: heldInColumn.length,
    averagePurchaseCents: heldInColumn.length === 0 ? null : Math.round(totalPurchaseCents / heldInColumn.length),
  }
}
