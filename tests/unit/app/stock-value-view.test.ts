import { describe, expect, it } from 'vitest'
import {
  buildStockValueChartData,
  describeGainRatioTone,
  describeGainTone,
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
    expect(describeStockItemValue(valuation({}), 10000, true)).toMatchObject({
      hasPrice: true,
      valueCents: 12000,
      gainCents: 2000,
      isApproximate: false,
      approximateTooltip: null,
    })
  })

  it('flags an approximate value with the condition actually used', () => {
    const description = describeStockItemValue(valuation({ approximate: true, usedCondition: 'neuf scellé' }), 15000, true)
    expect(description.isApproximate).toBe(true)
    expect(description.gainCents).toBe(-3000)
    expect(description.approximateTooltip).toBe('estimé à partir de l’état neuf scellé')
  })

  it('names the condition used by its label', () => {
    const description = describeStockItemValue(valuation({ approximate: true, usedCondition: 'opened-complete' }), 15000, true)
    expect(description.approximateTooltip).toBe('estimé à partir de l’état ouvert complet')
  })

  it('keeps the grading company and grade used for a graded card', () => {
    const description = describeStockItemValue(valuation({ approximate: true, usedCondition: 'PSA 9' }), 15000, true)
    expect(description.approximateTooltip).toBe('estimé à partir de l’état PSA 9')
  })

  it('reports no price instead of zero when nothing is valued', () => {
    expect(describeStockItemValue(valuation({ valueCents: null, usedCondition: null }), 10000, true)).toMatchObject({
      hasPrice: false,
      valueCents: null,
      gainCents: null,
    })
  })

  it('reports no price when a held item has no valuation', () => {
    expect(describeStockItemValue(undefined, 10000, true)).toMatchObject({ state: 'no-price', hasPrice: false, valueCents: null, gainCents: null })
  })

  it('reports not applicable for an item that is not held, even with a valuation', () => {
    expect(describeStockItemValue(valuation({}), 10000, false)).toMatchObject({
      state: 'not-applicable',
      hasPrice: false,
      valueCents: null,
      gainCents: null,
    })
  })

  it('reports a valued state for a held valued item', () => {
    expect(describeStockItemValue(valuation({}), 10000, true).state).toBe('valued')
  })
})

describe('buildStockValueChartData', () => {
  const history: StockValueHistoryPointView[] = [
    { snapshotOn: '2026-10-02', purchaseCostCents: 9000, valuedPurchaseCostCents: 5000, estimatedValueCents: 6000 },
    { snapshotOn: '2026-10-01', purchaseCostCents: 8000, valuedPurchaseCostCents: 4000, estimatedValueCents: 4500 },
  ]

  it('plots the cost of the valued items against their value on a day axis sorted by date', () => {
    const chartData = buildStockValueChartData(history)
    expect(chartData.datasets.map(dataset => dataset.label)).toEqual(['Coût des exemplaires valorisés', 'Valeur'])
    expect(chartData.datasets[0]!.data.map(point => point.y)).toEqual([40, 50])
    expect(chartData.datasets[1]!.data.map(point => point.y)).toEqual([45, 60])
    expect(chartData.datasets[0]!.data[1]!.x - chartData.datasets[0]!.data[0]!.x).toBe(1)
  })

  it('has no datasets without history', () => {
    expect(buildStockValueChartData([]).datasets).toEqual([])
  })
})

describe('describeGainTone', () => {
  it('is green for a gain, red for a loss and neutral for zero or missing', () => {
    expect(describeGainTone(1)).toBe('text-success')
    expect(describeGainTone(-1)).toBe('text-error')
    expect(describeGainTone(0)).toBe('')
    expect(describeGainTone(null)).toBe('')
  })
})

describe('describeGainRatioTone', () => {
  it('follows the sign of the ratio and stays neutral when it shows as 0,0 %', () => {
    expect(describeGainRatioTone(0.25)).toBe('gain')
    expect(describeGainRatioTone(-0.25)).toBe('loss')
    expect(describeGainRatioTone(0)).toBe('neutral')
    expect(describeGainRatioTone(0.0004)).toBe('neutral')
    expect(describeGainRatioTone(-0.0004)).toBe('neutral')
    expect(describeGainRatioTone(0.0006)).toBe('gain')
  })
})
