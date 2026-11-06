import { describe, expect, it } from 'vitest'
import { medianCents } from '../../../shared/valuation/median.ts'
import { removeOutliers } from '../../../shared/valuation/remove-outliers.ts'

describe('medianCents', () => {
  it('returns null for an empty list', () => {
    expect(medianCents([])).toBeNull()
  })

  it('returns the middle value for an odd count', () => {
    expect(medianCents([300, 100, 200])).toBe(200)
  })

  it('returns the mean of the two middle values for an even count', () => {
    expect(medianCents([7000, 7400])).toBe(7200)
  })

  it('rounds half up', () => {
    expect(medianCents([100, 101])).toBe(101)
  })
})

describe('removeOutliers', () => {
  it('drops values outside the interquartile fences', () => {
    expect(removeOutliers([1000, 6400, 6500, 6600, 6700, 30000])).toEqual([6400, 6500, 6600, 6700])
  })

  it('keeps everything with fewer than 4 values', () => {
    expect(removeOutliers([1, 6500, 30000])).toEqual([1, 6500, 30000])
  })

  it('always answers a new sorted list, whatever the number of values', () => {
    const fewPrices = [30000, 1, 6500]

    const keptPrices = removeOutliers(fewPrices)

    expect(keptPrices).toEqual([1, 6500, 30000])
    expect(keptPrices).not.toBe(fewPrices)
    expect(fewPrices).toEqual([30000, 1, 6500])
  })

  it('keeps values lying exactly on a fence', () => {
    expect(removeOutliers([10, 10, 10, 10])).toEqual([10, 10, 10, 10])
  })
})
