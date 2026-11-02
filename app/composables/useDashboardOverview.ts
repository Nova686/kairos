import type { StockValueHistoryPointView } from '~/utils/stock-value-view'

export interface DashboardStockValueView {
  purchaseCostCents: number
  estimatedValueCents: number
  latentGainCents: number
  valuedItemCount: number
  approximateItemCount: number
  unvaluedItemCount: number
}

export interface DashboardRecentSaleView {
  id: string
  soldOn: string
  platform: string
  netProfitCents: number
}

export interface DashboardOverviewView {
  stockValue: DashboardStockValueView
  valueHistory: StockValueHistoryPointView[]
  recentSales: DashboardRecentSaleView[]
  deliveriesInProgress: { incoming: number, outgoing: number }
  debtTotals: { owedToMeCents: number, iOweCents: number }
}

export const useDashboardOverview = () => {
  const { data: overview, pending, error } = useFetch<DashboardOverviewView>('/api/dashboard')
  const chartData = computed(() => buildStockValueChartData(overview.value?.valueHistory ?? []))
  return { overview, chartData, pending, hasFailed: computed(() => error.value !== undefined && error.value !== null) }
}
