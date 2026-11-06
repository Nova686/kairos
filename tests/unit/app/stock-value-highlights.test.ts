import { describe, expect, it } from 'vitest'
import {
  buildStockValueChartData,
  describeStockValueHighlights,
  latestSnapshotDate,
  type StockValueHistoryPointView,
} from '../../../app/utils/stock-value-view.ts'

describe('describeStockValueHighlights', () => {
  const stockValue = {
    purchaseCostCents: 500000,
    valuedPurchaseCostCents: 400000,
    estimatedValueCents: 600000,
    latentGainCents: 200000,
    valuedItemCount: 8,
    approximateItemCount: 1,
    unvaluedItemCount: 2,
  }

  it('counts held items, valued or not, and relates the latent gain to the valued cost', () => {
    expect(describeStockValueHighlights(stockValue)).toEqual({ heldItemCount: 10, latentGainRatio: 0.5 })
  })

  it('has no ratio when no valued item carries a cost', () => {
    expect(describeStockValueHighlights({ ...stockValue, valuedPurchaseCostCents: 0, latentGainCents: 0 }).latentGainRatio).toBeNull()
  })
})

describe('latestSnapshotDate', () => {
  it('is the most recent snapshot day, or null without history', () => {
    const history: StockValueHistoryPointView[] = [
      { snapshotOn: '2026-10-02', purchaseCostCents: 1, valuedPurchaseCostCents: 1, estimatedValueCents: 1 },
      { snapshotOn: '2026-10-09', purchaseCostCents: 1, valuedPurchaseCostCents: 1, estimatedValueCents: 1 },
      { snapshotOn: '2026-10-05', purchaseCostCents: 1, valuedPurchaseCostCents: 1, estimatedValueCents: 1 },
    ]
    expect(latestSnapshotDate(history)).toBe('2026-10-09')
    expect(latestSnapshotDate([])).toBeNull()
  })
})

describe('stock value chart appearance', () => {
  it('draws the value as a filled blue line and the cost as a dashed grey one', () => {
    const [costDataset, valueDataset] = buildStockValueChartData([
      { snapshotOn: '2026-10-01', purchaseCostCents: 1, valuedPurchaseCostCents: 4000, estimatedValueCents: 4500 },
    ]).datasets
    expect(valueDataset).toMatchObject({ borderColor: '#6fa8dc', hasAreaFill: true })
    expect(costDataset).toMatchObject({ borderColor: '#8b97a8', isDashed: true })
    expect(costDataset!.hasAreaFill).toBeFalsy()
  })
})
