import { conditionCodesFor, conditionLabel } from '~~/shared/catalogue/condition-scale'
import { isProductCategory, type ProductCategory } from '~~/shared/catalogue/product-category'
import type { PriceOverviewCellView, ProductPriceOverviewView } from '~/utils/price-overview-view'
import type { UnavailableSource } from '~~/shared/prices/unavailable-source'

export interface PricedProductView {
  id: string
  name: string
  category: string
  imageUrl: string | null
  ebayQuery: string | null
  ebayExcludedKeywords: string[]
}

interface PriceScreen {
  product: PricedProductView
  overview: ProductPriceOverviewView
}

interface RequestFailure {
  statusCode?: number
  status?: number
  statusMessage?: string
  data?: { statusMessage?: string, data?: { remainingMinutes?: number } }
}

const tooManyRequestsStatus = 429
const notFoundStatus = 404

const describeFailure = (failure: unknown): string => {
  const requestFailure = failure as RequestFailure
  return requestFailure.data?.statusMessage ?? requestFailure.statusMessage ?? 'Une erreur est survenue.'
}

const describeRefreshRefusal = (failure: unknown): string | null => {
  const requestFailure = failure as RequestFailure
  if ((requestFailure.statusCode ?? requestFailure.status) !== tooManyRequestsStatus) {
    return null
  }
  const remainingMinutes = requestFailure.data?.data?.remainingMinutes
  return remainingMinutes === undefined
    ? 'Déjà relevé il y a moins de 10 minutes.'
    : `Déjà relevé il y a moins de 10 minutes : réessayez dans ${remainingMinutes} min.`
}

export const useProductPrices = async (productId: string, preferredCondition: string | null) => {
  const requestFetch = useRequestFetch()
  const sendRequest = $fetch as (path: string, options: { method: string, body?: unknown }) => Promise<unknown>
  const runExclusively = createExclusiveRunner()

  const { data: screen, refresh: refreshScreen } = await useAsyncData<PriceScreen | null>(
    `product-prices-${productId}`,
    async () => {
      try {
        const product = await requestFetch<PricedProductView>(`/api/products/${productId}`)
        const overview = await requestFetch<ProductPriceOverviewView>(`/api/products/${productId}/prices`)
        return { product, overview }
      }
      catch (failure) {
        const requestFailure = failure as RequestFailure
        if ((requestFailure.statusCode ?? requestFailure.status) === notFoundStatus) {
          return null
        }
        throw failure
      }
    },
  )

  const product = computed(() => screen.value?.product ?? null)
  const overview = computed(() => screen.value?.overview ?? null)
  const category = computed<ProductCategory>(() => {
    const productCategory = product.value?.category ?? 'other'
    return isProductCategory(productCategory) ? productCategory : 'other'
  })
  const cells = computed(() => overview.value?.bySourceAndCondition ?? [])
  const columns = computed(() => buildPriceColumns(category.value, cells.value))
  const rows = computed(() => buildPriceRows(cells.value, columns.value))
  const cardReferences = computed(() => overview.value?.cardReferences ?? [])
  const lastRefreshedAt = computed(() => overview.value?.lastRefreshedAt ?? null)
  const conditionOptions = computed(() =>
    conditionCodesFor(category.value).map(code => ({ value: code, title: conditionLabel(code) })))

  const selectedColumnKey = ref<string | null>(chooseDefaultColumnKey(columns.value, preferredCondition))
  const selectedColumn = computed(() => columns.value.find(column => column.key === selectedColumnKey.value) ?? null)
  const selectedColumnIndex = computed(() => columns.value.findIndex(column => column.key === selectedColumnKey.value))
  const retainedPrice = computed(() => describeRetainedPrice(rows.value, selectedColumnIndex.value))
  const chartData = computed(() => buildHistoryChartData(overview.value?.history ?? [], selectedColumn.value))
  const columnOptions = computed(() => columns.value.map(column => ({ value: column.key, title: column.label })))

  const errorMessage = ref('')
  const refreshMessage = ref('')
  const isRefreshing = ref(false)
  const openedSnapshotId = ref<string | null>(null)
  const openedCell = computed(() => cells.value.find(priceCell => priceCell.snapshotId === openedSnapshotId.value) ?? null)
  const isRefreshPending = computed(() => overview.value?.isRefreshPending ?? false)

  const keepSelectedColumnValid = () => {
    if (selectedColumn.value === null) {
      selectedColumnKey.value = chooseDefaultColumnKey(columns.value, preferredCondition)
    }
  }

  const reloadScreen = async () => {
    await refreshScreen()
    keepSelectedColumnValid()
  }

  const refreshNow = () =>
    runExclusively(async () => {
      errorMessage.value = ''
      refreshMessage.value = ''
      isRefreshing.value = true
      try {
        const outcome = await sendRequest(`/api/products/${productId}/refresh-prices`, { method: 'POST' }) as { unavailableSources?: UnavailableSource[] }
        refreshMessage.value = describeRefreshOutcome(outcome.unavailableSources ?? [])
        await reloadScreen()
      }
      catch (failure) {
        const refusal = describeRefreshRefusal(failure)
        if (refusal === null) {
          errorMessage.value = describeFailure(failure)
        }
        else {
          refreshMessage.value = refusal
        }
      }
      finally {
        isRefreshing.value = false
      }
    })

  const openListings = (priceCell: PriceOverviewCellView) => {
    openedSnapshotId.value = priceCell.snapshotId
  }

  const closeListings = () => {
    openedSnapshotId.value = null
  }

  const changeListingExclusion = (listingUrl: string, method: 'POST' | 'DELETE', message: string) =>
    runExclusively(async () => {
      errorMessage.value = ''
      try {
        await sendRequest(`/api/products/${productId}/excluded-listings`, { method, body: { url: listingUrl } })
        refreshMessage.value = message
        await reloadScreen()
      }
      catch (failure) {
        errorMessage.value = describeFailure(failure)
      }
    })

  const excludeListing = (listingUrl: string) =>
    changeListingExclusion(listingUrl, 'POST', 'Annonce exclue : un nouveau relevé est programmé.')

  const restoreListing = (listingUrl: string) =>
    changeListingExclusion(listingUrl, 'DELETE', 'Annonce rétablie : un nouveau relevé est programmé.')

  const saveManualPrice = async (body: Record<string, unknown>): Promise<boolean> => {
    const outcome = await runExclusively(async () => {
      errorMessage.value = ''
      try {
        await sendRequest(`/api/products/${productId}/manual-prices`, { method: 'POST', body })
        await reloadScreen()
        return true
      }
      catch (failure) {
        errorMessage.value = describeFailure(failure)
        return false
      }
    })
    return outcome === true
  }

  const saveEbaySettings = async (ebayQuery: string | null, ebayExcludedKeywords: string[]): Promise<boolean> => {
    const outcome = await runExclusively(async () => {
      errorMessage.value = ''
      try {
        await sendRequest(`/api/products/${productId}`, { method: 'PATCH', body: { ebayQuery, ebayExcludedKeywords } })
        await reloadScreen()
        return true
      }
      catch (failure) {
        errorMessage.value = describeFailure(failure)
        return false
      }
    })
    return outcome === true
  }

  return {
    product,
    category,
    columns,
    rows,
    cardReferences,
    lastRefreshedAt,
    conditionOptions,
    columnOptions,
    selectedColumnKey,
    selectedColumn,
    selectedColumnIndex,
    retainedPrice,
    chartData,
    errorMessage,
    refreshMessage,
    isRefreshing,
    openedCell,
    isRefreshPending,
    refreshNow,
    openListings,
    closeListings,
    excludeListing,
    restoreListing,
    saveManualPrice,
    saveEbaySettings,
  }
}
