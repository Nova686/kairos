import { describe, expect, it } from 'vitest'
import {
  describeConditionChipTone,
  sortStockListRows,
  summarizeHeldStock,
  type StockListSortableRow,
} from '../../../app/utils/stock-list-view.ts'
import type { StockItemValueDescription } from '../../../app/utils/stock-value-view.ts'

const valueDescription = (overrides: Partial<StockItemValueDescription>): StockItemValueDescription => ({
  state: 'valued',
  hasPrice: true,
  valueCents: 12000,
  gainCents: 2000,
  isApproximate: false,
  approximateTooltip: null,
  ...overrides,
})

const row = (overrides: Partial<StockListSortableRow>): StockListSortableRow => ({
  productName: 'Display',
  purchasePriceCents: 10000,
  valueCents: 12000,
  gainCents: 2000,
  valueDescription: valueDescription({}),
  ...overrides,
})

describe('sortStockListRows', () => {
  const rows = [
    row({ productName: 'Bulbizarre', valueCents: 5000, gainCents: -500 }),
    row({ productName: 'Ectoplasma', valueCents: null, gainCents: null }),
    row({ productName: 'Abra', valueCents: 9000, gainCents: 4000 }),
  ]

  it('keeps the incoming order for the recent sort', () => {
    expect(sortStockListRows(rows, 'recent').map(sortedRow => sortedRow.productName)).toEqual(['Bulbizarre', 'Ectoplasma', 'Abra'])
  })

  it('puts the biggest gain first and rows without gain last', () => {
    expect(sortStockListRows(rows, 'gain').map(sortedRow => sortedRow.productName)).toEqual(['Abra', 'Bulbizarre', 'Ectoplasma'])
  })

  it('puts the highest value first and rows without value last', () => {
    expect(sortStockListRows(rows, 'value').map(sortedRow => sortedRow.productName)).toEqual(['Abra', 'Bulbizarre', 'Ectoplasma'])
  })

  it('sorts names alphabetically without mutating the input', () => {
    expect(sortStockListRows(rows, 'name').map(sortedRow => sortedRow.productName)).toEqual(['Abra', 'Bulbizarre', 'Ectoplasma'])
    expect(rows[0]!.productName).toBe('Bulbizarre')
  })
})

describe('summarizeHeldStock', () => {
  it('counts held rows, sums their cost and sums only the valued ones', () => {
    const summary = summarizeHeldStock([
      row({ purchasePriceCents: 10000, valueCents: 12000 }),
      row({ purchasePriceCents: 5000, valueCents: null, valueDescription: valueDescription({ state: 'no-price', hasPrice: false, valueCents: null, gainCents: null }) }),
      row({ purchasePriceCents: 7000, valueCents: null, valueDescription: valueDescription({ state: 'not-applicable', hasPrice: false, valueCents: null, gainCents: null }) }),
    ])
    expect(summary).toEqual({ heldCount: 2, unpricedCount: 1, investedCents: 15000, valuedCents: 12000 })
  })
})

describe('describeConditionChipTone', () => {
  it('tints sealed products blue, graded cards amber and everything else neutral', () => {
    expect(describeConditionChipTone('pokemon-sealed')).toBe('primary')
    expect(describeConditionChipTone('graded-card')).toBe('accent')
    expect(describeConditionChipTone('toy')).toBe('neutral')
    expect(describeConditionChipTone('unknown')).toBe('neutral')
  })
})
