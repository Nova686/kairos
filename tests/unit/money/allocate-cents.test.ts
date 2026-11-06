import { allocateCents } from '../../../shared/money/allocate-cents.ts'

const createSeededGenerator = (seed: number) => {
  let state = seed
  return (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('allocateCents', () => {
  it('gives the extra cent to the lowest index on equal fractional parts', () => {
    expect(allocateCents(10000, [1, 1, 1])).toEqual([3334, 3333, 3333])
  })

  it('hands a single cent to the first of two equal weights', () => {
    expect(allocateCents(1, [1, 1])).toEqual([1, 0])
  })

  it('allocates nothing from a zero total', () => {
    expect(allocateCents(0, [2, 1])).toEqual([0, 0])
  })

  it('falls back to equal weights when every weight is zero', () => {
    expect(allocateCents(1000, [0, 0])).toEqual([500, 500])
  })

  it('gives the leftover cents to the largest fractional parts', () => {
    expect(allocateCents(10, [1, 2, 3])).toEqual([2, 3, 5])
    expect(allocateCents(5, [1, 1, 3])).toEqual([1, 1, 3])
    expect(allocateCents(7, [3, 3, 1])).toEqual([3, 3, 1])
    expect(allocateCents(2, [1, 3, 3])).toEqual([0, 1, 1])
  })

  it('throws on an empty list of weights', () => {
    expect(() => allocateCents(100, [])).toThrow()
  })

  it('throws on a negative total', () => {
    expect(() => allocateCents(-1, [1])).toThrow()
  })

  it('always sums to the total and never allocates a negative share over 200 seeded cases', () => {
    const nextRandom = createSeededGenerator(20261102)
    for (let caseIndex = 0; caseIndex < 200; caseIndex++) {
      const totalCents = Math.floor(nextRandom() * 100000)
      const weights = Array.from({ length: 1 + Math.floor(nextRandom() * 8) }, () => Math.floor(nextRandom() * 50))

      const shares = allocateCents(totalCents, weights)

      expect(shares).toHaveLength(weights.length)
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(totalCents)
      expect(shares.every(share => share >= 0)).toBe(true)
    }
  })
})
