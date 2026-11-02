import type { StockItemValuationView } from '~/utils/stock-value-view'

interface StockValueResponse {
  items: { stockItemId: string, valuation: StockItemValuationView }[]
}

interface PriceRefreshResponse {
  queuedProductCount: number
}

const describeQueuedProducts = (queuedProductCount: number): string =>
  queuedProductCount === 0
    ? 'Aucun produit à relever.'
    : `${queuedProductCount} ${queuedProductCount === 1 ? 'produit programmé' : 'produits programmés'}`

export const useStockValue = () => {
  const sendRequest = $fetch as (path: string, options: { method: string }) => Promise<PriceRefreshResponse>
  const runExclusively = createExclusiveRunner()

  const { data: fetchedStockValue, refresh: reloadStockValue } = useFetch<StockValueResponse>('/api/stock/value', {
    default: () => ({ items: [] }),
  })

  const valuationsByStockItemId = computed(() =>
    new Map((fetchedStockValue.value?.items ?? []).map(valuedItem => [valuedItem.stockItemId, valuedItem.valuation])))

  const refreshMessage = ref('')
  const errorMessage = ref('')
  const isRefreshingAll = ref(false)

  const refreshAllPrices = () =>
    runExclusively(async () => {
      refreshMessage.value = ''
      errorMessage.value = ''
      isRefreshingAll.value = true
      try {
        const outcome = await sendRequest('/api/stock/refresh-prices', { method: 'POST' })
        refreshMessage.value = describeQueuedProducts(outcome.queuedProductCount)
        await reloadStockValue()
      }
      catch {
        errorMessage.value = 'Impossible de programmer le relevé des prix.'
      }
      finally {
        isRefreshingAll.value = false
      }
    })

  return { valuationsByStockItemId, refreshAllPrices, refreshMessage, errorMessage, isRefreshingAll }
}
