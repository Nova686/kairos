import { describe, expect, it } from 'vitest'
import { columnKeyOfStockItem, summarizeProductHoldings } from '../../../app/utils/product-holdings-view.ts'
import type { StockItemRow } from '../../../shared/stock/stock-item-row.ts'

const stockItem = (overrides: Partial<StockItemRow>): StockItemRow => ({
  id: 'item-1',
  productId: 'product-1',
  purchaseId: 'purchase-1',
  productName: 'ETB',
  productImageUrl: null,
  productCategory: 'pokemon-sealed',
  condition: 'sealed-new',
  gradingCompany: null,
  grade: null,
  certificateNumber: null,
  allocatedPurchaseCents: 6000,
  locationId: null,
  status: 'in-stock',
  notes: null,
  receivedOn: null,
  ...overrides,
})

describe('columnKeyOfStockItem', () => {
  it('is the condition code, or the grading company and grade for a graded card', () => {
    expect(columnKeyOfStockItem(stockItem({}))).toBe('sealed-new')
    expect(columnKeyOfStockItem(stockItem({ condition: 'graded', gradingCompany: 'PSA', grade: '10' }))).toBe('graded|PSA|10')
  })
})

describe('summarizeProductHoldings', () => {
  const stockItems = [
    stockItem({ id: 'a', allocatedPurchaseCents: 6000 }),
    stockItem({ id: 'b', allocatedPurchaseCents: 7000 }),
    stockItem({ id: 'c', allocatedPurchaseCents: 1000, condition: 'opened-complete' }),
    stockItem({ id: 'd', allocatedPurchaseCents: 9000, status: 'sold' }),
    stockItem({ id: 'e', allocatedPurchaseCents: 9000, productId: 'product-2' }),
  ]

  it('counts the held items of the product and averages the cost of those in the selected column', () => {
    expect(summarizeProductHoldings(stockItems, 'product-1', 'sealed-new')).toEqual({
      heldCount: 3,
      heldInColumnCount: 2,
      averagePurchaseCents: 6500,
    })
  })

  it('has no average when nothing is held in the selected column', () => {
    expect(summarizeProductHoldings(stockItems, 'product-1', 'good')).toEqual({ heldCount: 3, heldInColumnCount: 0, averagePurchaseCents: null })
    expect(summarizeProductHoldings(stockItems, 'product-1', null).averagePurchaseCents).toBeNull()
  })
})
