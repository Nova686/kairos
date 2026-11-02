import { allocateSaleNetCents, computeSaleNetCents } from '../../../shared/money/sale-profit.ts'

const baseSale = {
  totalPriceCents: 10000,
  platformFeesCents: 800,
  packagingCostCents: 100,
  shippingIncluded: true,
  shippingCostCents: 600,
}

describe('computeSaleNetCents', () => {
  it('subtracts fees, packaging and shipping when shipping is included', () => {
    expect(computeSaleNetCents(baseSale)).toBe(8500)
  })

  it('ignores the shipping cost when shipping is not included', () => {
    expect(computeSaleNetCents({ ...baseSale, shippingIncluded: false })).toBe(9100)
  })

  it('goes negative when costs exceed the price', () => {
    expect(computeSaleNetCents({ ...baseSale, totalPriceCents: 500 })).toBe(-1000)
  })
})

describe('allocateSaleNetCents', () => {
  it('splits proportionally to the weights', () => {
    expect(allocateSaleNetCents(8000, [3000, 1000])).toEqual([6000, 2000])
  })

  it('splits a negative net with shares summing exactly to it', () => {
    const shares = allocateSaleNetCents(-1001, [1, 1, 1])
    expect(shares).toEqual([-334, -334, -333])
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(-1001)
  })

  it('splits a zero net into zero shares', () => {
    expect(allocateSaleNetCents(0, [1, 2])).toEqual([0, 0])
  })
})
