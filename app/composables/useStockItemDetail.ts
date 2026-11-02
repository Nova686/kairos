import { conditionCodesFor, conditionLabel, type ConditionCode } from '~~/shared/catalogue/condition-scale'
import { isProductCategory } from '~~/shared/catalogue/product-category'
import type { LocationRow, StockItemRow } from '~~/shared/stock/stock-item-row'

export interface ProductChangeRow {
  id: string
  fieldName: string
  previousValue: unknown
  newValue: unknown
  changedAt: string
}

interface StockItemDetail {
  stockItem: StockItemRow
  changes: ProductChangeRow[]
}

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export const useStockItemDetail = async (stockItemId: string) => {
  const requestFetch = useRequestFetch()
  const sendRequest = $fetch as (path: string, options: { method: string, body?: unknown }) => Promise<unknown>
  const { data: fetchedLocations } = useFetch<LocationRow[]>('/api/locations', { default: () => [] })
  const editedCondition = ref<ConditionCode | null>(null)
  const editedLocationId = ref<string | null>(null)
  const editedNotes = ref('')
  const errorMessage = ref('')

  const { data: detail, refresh: refreshDetail } = await useAsyncData<StockItemDetail>(
    `stock-item-${stockItemId}`,
    async () => {
      const stockItem = await requestFetch<StockItemRow>(`/api/stock-items/${stockItemId}`)
      const changes = await requestFetch<ProductChangeRow[]>(`/api/products/${stockItem.productId}/changes`)
      return { stockItem, changes }
    },
  )

  const stockItem = computed(() => detail.value?.stockItem ?? null)
  const changes = computed<ProductChangeRow[]>(() => detail.value?.changes ?? [])
  const locations = computed<LocationRow[]>(() => fetchedLocations.value ?? [])
  const isInTransit = computed(() => stockItem.value?.status === 'in-transit')

  const conditionOptions = computed(() => {
    const category = stockItem.value?.productCategory ?? 'other'
    return conditionCodesFor(isProductCategory(category) ? category : 'other')
      .map(code => ({ value: code, title: conditionLabel(code) }))
  })

  const loadEditedValues = () => {
    if (stockItem.value === null) {
      return
    }
    editedCondition.value = stockItem.value.condition as ConditionCode
    editedLocationId.value = stockItem.value.locationId
    editedNotes.value = stockItem.value.notes ?? ''
  }

  const runMutation = async (mutation: () => Promise<unknown>): Promise<void> => {
    errorMessage.value = ''
    try {
      await mutation()
      await refreshDetail()
      loadEditedValues()
    }
    catch (failure) {
      errorMessage.value = describeFailure(failure)
    }
  }

  const saveChanges = () =>
    runMutation(() => sendRequest(`/api/stock-items/${stockItemId}`, {
      method: 'PATCH',
      body: {
        condition: editedCondition.value,
        locationId: editedLocationId.value,
        notes: editedNotes.value.trim() === '' ? null : editedNotes.value,
      },
    }))

  const receiveStockItem = () =>
    runMutation(() => sendRequest(`/api/stock-items/${stockItemId}/receive`, {
      method: 'POST',
      body: { receivedOn: new Date().toISOString().slice(0, 10) },
    }))

  loadEditedValues()

  return {
    stockItem,
    locations,
    changes,
    editedCondition,
    editedLocationId,
    editedNotes,
    conditionOptions,
    isInTransit,
    errorMessage,
    saveChanges,
    receiveStockItem,
  }
}
