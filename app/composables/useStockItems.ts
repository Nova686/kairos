import type { LocationRow, StockItemRow } from '~~/shared/stock/stock-item-row'
import type { StockItemStatus } from '~~/shared/stock/stock-item-status'

export interface StockFilterValues {
  status: StockItemStatus | null
  category: string | null
  locationId: string | null
  search: string
}

export const useStockItems = () => {
  const filters = reactive<StockFilterValues>({ status: null, category: null, locationId: null, search: '' })

  const filterQuery = computed(() => ({
    status: filters.status ?? undefined,
    category: filters.category ?? undefined,
    locationId: filters.locationId ?? undefined,
    search: filters.search.trim() === '' ? undefined : filters.search.trim(),
  }))

  const { data: fetchedStockItems, pending } = useFetch<StockItemRow[]>('/api/stock-items', {
    query: filterQuery,
    default: () => [],
  })
  const { data: fetchedLocations } = useFetch<LocationRow[]>('/api/locations', { default: () => [] })

  const stockItems = computed<StockItemRow[]>(() => fetchedStockItems.value ?? [])
  const locations = computed<LocationRow[]>(() => fetchedLocations.value ?? [])
  const locationLabelsById = computed(() => new Map(locations.value.map(location => [location.id, location.label])))

  return { filters, stockItems, locations, locationLabelsById, pending }
}
