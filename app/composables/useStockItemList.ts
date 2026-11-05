import type { StockItemRow } from '~~/shared/stock/stock-item-row'
import { heldStockItemStatuses, stockItemStatusLabels } from '~~/shared/stock/stock-item-status'
import { describeStockItemValue, type StockItemValueDescription, type StockItemValuationView } from '~/utils/stock-value-view'
import {
  describeConditionChipTone,
  sortStockListRows,
  summarizeHeldStock,
  type ConditionChipTone,
  type StockSortKey,
} from '~/utils/stock-list-view'

export interface StockItemListRow {
  id: string
  productName: string
  productCategory: string
  productImageUrl: string | null
  conditionText: string
  conditionTone: ConditionChipTone
  locationText: string
  statusText: string
  purchasePriceCents: number
  valueCents: number | null
  gainCents: number | null
  valueDescription: StockItemValueDescription
}

const tableHeaders = [
  { title: 'Produit', key: 'productName' },
  { title: 'État', key: 'conditionText' },
  { title: 'Lieu', key: 'locationText', headerProps: { class: 'stock-item-list__location-column' }, cellProps: { class: 'stock-item-list__location-column' } },
  { title: 'Statut', key: 'statusText' },
  { title: 'Achat', key: 'purchasePriceCents', align: 'end' as const },
  { title: 'Valeur estimée', key: 'valueCents', align: 'end' as const },
  { title: 'Plus-value', key: 'gainCents', align: 'end' as const },
]

export const useStockItemList = (
  stockItems: () => StockItemRow[],
  locationLabelsById: () => Map<string, string>,
  valuationsByStockItemId: () => Map<string, StockItemValuationView>,
  sortKey: () => StockSortKey,
) => {
  const unsortedRows = computed<StockItemListRow[]>(() =>
    stockItems().map((stockItem) => {
      const valueDescription = describeStockItemValue(
        valuationsByStockItemId().get(stockItem.id),
        stockItem.allocatedPurchaseCents,
        heldStockItemStatuses.includes(stockItem.status),
      )
      return {
        id: stockItem.id,
        productName: stockItem.productName,
        productCategory: stockItem.productCategory,
        productImageUrl: stockItem.productImageUrl,
        conditionText: describeStockItemCondition(stockItem.condition, stockItem.gradingCompany, stockItem.grade),
        conditionTone: describeConditionChipTone(stockItem.productCategory),
        locationText: stockItem.locationId === null ? '—' : (locationLabelsById().get(stockItem.locationId) ?? '—'),
        statusText: stockItemStatusLabels[stockItem.status],
        purchasePriceCents: stockItem.allocatedPurchaseCents,
        valueCents: valueDescription.valueCents,
        gainCents: valueDescription.gainCents,
        valueDescription,
      }
    }),
  )

  const listRows = computed(() => sortStockListRows(unsortedRows.value, sortKey()))
  const heldStockSummary = computed(() => summarizeHeldStock(unsortedRows.value))

  return { listRows, heldStockSummary, tableHeaders }
}
