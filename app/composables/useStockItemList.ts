import type { StockItemRow } from '~~/shared/stock/stock-item-row'
import { stockItemStatusLabels } from '~~/shared/stock/stock-item-status'

export interface StockItemListRow {
  id: string
  productName: string
  productImageUrl: string | null
  conditionText: string
  locationText: string
  statusText: string
  purchasePriceCents: number
}

const tableHeaders = [
  { title: '', key: 'productImageUrl', sortable: false },
  { title: 'Produit', key: 'productName' },
  { title: 'État', key: 'conditionText' },
  { title: 'Lieu', key: 'locationText' },
  { title: 'Statut', key: 'statusText' },
  { title: 'Prix d’achat', key: 'purchasePriceCents', align: 'end' as const },
]

export const useStockItemList = (
  stockItems: () => StockItemRow[],
  locationLabelsById: () => Map<string, string>,
) => {
  const listRows = computed<StockItemListRow[]>(() =>
    stockItems().map(stockItem => ({
      id: stockItem.id,
      productName: stockItem.productName,
      productImageUrl: stockItem.productImageUrl,
      conditionText: describeStockItemCondition(stockItem.condition, stockItem.gradingCompany, stockItem.grade),
      locationText: stockItem.locationId === null ? '—' : (locationLabelsById().get(stockItem.locationId) ?? '—'),
      statusText: stockItemStatusLabels[stockItem.status],
      purchasePriceCents: stockItem.allocatedPurchaseCents,
    })),
  )

  return { listRows, tableHeaders }
}
