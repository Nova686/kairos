import { describe, expect, it } from 'vitest'
import {
  buildStockValueChartData,
  describeStockItemValue,
  type StockItemValuationView,
  type StockValueHistoryPointView,
} from '../../../app/utils/stock-value-view.ts'

const valuation = (overrides: Partial<StockItemValuationView>): StockItemValuationView => ({
  valueCents: 12000,
  approximate: false,
  usedCondition: 'neuf scellé',
  ...overrides,
})

describe('describeStockItemValue', () => {
  it('shows value and a positive gain against the allocated purchase price', () => {
    expect(describeStockItemValue(valuation({}), 10000)).toMatchObject({
      hasPrice: true,
      valueCents: 12000,
      gainCents: 2000,
      isApproximate: false,
      approximateTooltip: null,
    })
  })

  it('flags an approximate value with the condition actually used', () => {
    const description = describeStockItemValue(valuation({ approximate: true, usedCondition: 'neuf scellé' }), 15000)
    expect(description.isApproximate).toBe(true)
    expect(description.gainCents).toBe(-3000)
    expect(description.approximateTooltip).toBe('estimé à partir de l’état neuf scellé')
  })

  it('reports no price instead of zero when nothing is valued', () => {
    expect(describeStockItemValue(valuation({ valueCents: null, usedCondition: null }), 10000)).toMatchObject({
      hasPrice: false,
      valueCents: null,
      gainCents: null,
    })
  })

  it('reports no price when the item has no valuation', () => {
    expect(describeStockItemValue(undefined, 10000)).toMatchObject({ hasPrice: false, valueCents: null, gainCents: null })
  })
})

describe('buildStockValueChartData', () => {
  const history: StockValueHistoryPointView[] = [
    { snapshotOn: '2026-10-02', purchaseCostCents: 5000, estimatedValueCents: 6000 },
    { snapshotOn: '2026-10-01', purchaseCostCents: 4000, estimatedValueCents: 4500 },
  ]

  it('builds a cost line and a value line on a day axis sorted by date', () => {
    const chartData = buildStockValueChartData(history)
    expect(chartData.datasets.map(dataset => dataset.label)).toEqual(['Coût', 'Valeur'])
    expect(chartData.datasets[0]!.data.map(point => point.y)).toEqual([40, 50])
    expect(chartData.datasets[1]!.data.map(point => point.y)).toEqual([45, 60])
    expect(chartData.datasets[0]!.data[1]!.x - chartData.datasets[0]!.data[0]!.x).toBe(1)
  })

  it('has no datasets without history', () => {
    expect(buildStockValueChartData([]).datasets).toEqual([])
  })
})
