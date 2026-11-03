import { dayNumberOf, type PriceChartData } from './price-overview-view.ts'

export interface StockItemValuationView {
  valueCents: number | null
  approximate: boolean
  usedCondition: string | null
}

export interface StockValueHistoryPointView {
  snapshotOn: string
  purchaseCostCents: number
  valuedPurchaseCostCents: number
  estimatedValueCents: number
}

export type StockItemValueState = 'valued' | 'no-price' | 'not-applicable'

export interface StockItemValueDescription {
  state: StockItemValueState
  hasPrice: boolean
  valueCents: number | null
  gainCents: number | null
  isApproximate: boolean
  approximateTooltip: string | null
}

export const describeStockItemValue = (
  valuation: StockItemValuationView | undefined,
  allocatedPurchaseCents: number,
  isHeld: boolean,
): StockItemValueDescription => {
  if (!isHeld) {
    return { state: 'not-applicable', hasPrice: false, valueCents: null, gainCents: null, isApproximate: false, approximateTooltip: null }
  }
  if (valuation === undefined || valuation.valueCents === null) {
    return { state: 'no-price', hasPrice: false, valueCents: null, gainCents: null, isApproximate: false, approximateTooltip: null }
  }
  return {
    state: 'valued',
    hasPrice: true,
    valueCents: valuation.valueCents,
    gainCents: valuation.valueCents - allocatedPurchaseCents,
    isApproximate: valuation.approximate,
    approximateTooltip: valuation.approximate && valuation.usedCondition !== null
      ? `estimé à partir de l’état ${valuation.usedCondition}`
      : null,
  }
}

export const describeGainTone = (gainCents: number | null): string => {
  if (gainCents === null || gainCents === 0) {
    return ''
  }
  return gainCents > 0 ? 'text-success' : 'text-error'
}

const costLineColor = '#757575'
const valueLineColor = '#1e88e5'

export const buildStockValueChartData = (history: StockValueHistoryPointView[]): PriceChartData => {
  if (history.length === 0) {
    return { datasets: [] }
  }
  const sortedHistory = [...history].sort((left, right) => left.snapshotOn.localeCompare(right.snapshotOn))
  return {
    datasets: [
      {
        label: 'Coût des exemplaires valorisés',
        data: sortedHistory.map(historyPoint => ({ x: dayNumberOf(historyPoint.snapshotOn), y: historyPoint.valuedPurchaseCostCents / 100 })),
        borderColor: costLineColor,
        backgroundColor: costLineColor,
        spanGaps: false,
      },
      {
        label: 'Valeur',
        data: sortedHistory.map(historyPoint => ({ x: dayNumberOf(historyPoint.snapshotOn), y: historyPoint.estimatedValueCents / 100 })),
        borderColor: valueLineColor,
        backgroundColor: valueLineColor,
        spanGaps: false,
      },
    ],
  }
}
