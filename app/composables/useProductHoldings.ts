import type { StockItemRow } from '~~/shared/stock/stock-item-row'

export const useProductHoldings = (
  productId: string,
  selectedColumnKey: () => string | null,
  retainedValueCents: () => number | null,
) => {
  const { data: fetchedStockItems } = useFetch<StockItemRow[]>('/api/stock-items', { query: { productId }, default: () => [] })

  const holdings = computed(() => summarizeProductHoldings(fetchedStockItems.value ?? [], productId, selectedColumnKey()))

  const gainPerItemCents = computed(() => {
    const retainedCents = retainedValueCents()
    const averagePurchaseCents = holdings.value.averagePurchaseCents
    return retainedCents === null || averagePurchaseCents === null ? null : retainedCents - averagePurchaseCents
  })

  return { holdings, gainPerItemCents }
}
