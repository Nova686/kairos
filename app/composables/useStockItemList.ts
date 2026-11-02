import type { StockItemRow } from '~~/shared/stock/stock-item-row'
import { stockItemStatusLabels } from '~~/shared/stock/stock-item-status'
import { describeStockItemValue, type StockItemValueDescription, type StockItemValuationView } from '~/utils/stock-value-view'

export interface StockItemListRow {
  id: string
  productName: string
  productImageUrl: string | null
  conditionText: string
  locationText: string
  statusText: string
  purchasePriceCents: number
  valueCents: number | null
  gainCents: number | null
  valueDescription: StockItemValueDescription
}

const heldStatuses: string[] = ['in-transit', 'in-stock']

const tableHeaders = [
  { title: '', key: 'productImageUrl', sortable: false },
  { title: 'Produit', key: 'productName' },
  { title: 'État', key: 'conditionText' },
  { title: 'Lieu', key: 'locationText' },
  { title: 'Statut', key: 'statusText' },
  { title: 'Prix d’achat', key: 'purchasePriceCents', align: 'end' as const },
  { title: 'Valeur estimée', key: 'valueCents', align: 'end' as const },
  { title: 'Gain', key: 'gainCents', align: 'end' as const },
]

export const useStockItemList = (
  stockItems: () => StockItemRow[],
  locationLabelsById: () => Map<string, string>,
  valuationsByStockItemId: () => Map<string, StockItemValuationView>,
) => {
  const listRows = computed<StockItemListRow[]>(() =>
    stockItems().map((stockItem) => {
      const valueDescription = describeStockItemValue(
        valuationsByStockItemId().get(stockItem.id),
        stockItem.allocatedPurchaseCents,
        heldStatuses.includes(stockItem.status),
      )
      return {
        id: stockItem.id,
        productName: stockItem.productName,
        productImageUrl: stockItem.productImageUrl,
        conditionText: describeStockItemCondition(stockItem.condition, stockItem.gradingCompany, stockItem.grade),
        locationText: stockItem.locationId === null ? '—' : (locationLabelsById().get(stockItem.locationId) ?? '—'),
        statusText: stockItemStatusLabels[stockItem.status],
        purchasePriceCents: stockItem.allocatedPurchaseCents,
        valueCents: valueDescription.valueCents,
        gainCents: valueDescription.gainCents,
        valueDescription,
      }
    }),
  )

  return { listRows, tableHeaders }
}
