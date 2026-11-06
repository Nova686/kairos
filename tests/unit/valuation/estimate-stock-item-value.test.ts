import { describe, expect, it } from 'vitest'
import type { ValuationSnapshot } from '../../../shared/valuation/estimate-stock-item-value.ts'
import { estimateStockItemValue } from '../../../shared/valuation/estimate-stock-item-value.ts'

const now = new Date('2026-11-02T12:00:00Z')
const daysAgo = (days: number, extraMinutes = 0): Date =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000 - extraMinutes * 60 * 1000)

const snapshot = (overrides: Partial<ValuationSnapshot>): ValuationSnapshot => ({
  source: 'ebay',
  kind: 'active',
  kairosCondition: 'sealed-new',
  gradingCompany: null,
  grade: null,
  observedAt: daysAgo(1),
  figureCents: 1000,
  ...overrides,
})

const sealedProduct = (condition: 'sealed-new' | 'sealed-damaged-box' | 'opened-complete') => ({
  category: 'pokemon-sealed' as const,
  condition,
  gradingCompany: null,
  grade: null,
})

const gradedCard = (company: string, grade: string) => ({
  category: 'graded-card' as const,
  condition: 'graded' as const,
  gradingCompany: company,
  grade,
})

describe('estimateStockItemValue', () => {
  it('takes the median of per-source figures, with manual entries medianed per source', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ source: 'ebay', figureCents: 6500, observedAt: daysAgo(2) }),
      snapshot({ source: 'cardmarket', kind: 'source-aggregate', kairosCondition: null, figureCents: 15123 }),
      snapshot({ source: 'vinted', kind: 'manual', figureCents: 7000, observedAt: daysAgo(3) }),
      snapshot({ source: 'vinted', kind: 'manual', figureCents: 7400, observedAt: daysAgo(3) }),
    ], now)
    expect(valuation.valueCents).toBe(7200)
    expect(valuation.approximate).toBe(false)
    expect(valuation.usedCondition).toBe('sealed-new')
    expect(valuation.perSource.map(entry => [entry.source, entry.figureCents]).sort())
      .toEqual([['cardmarket', 15123], ['ebay', 6500], ['vinted', 7200]])
  })

  it('uses only the newest active snapshot per source and condition', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ figureCents: 9000, observedAt: daysAgo(5) }),
      snapshot({ figureCents: 6000, observedAt: daysAgo(1) }),
    ], now)
    expect(valuation.valueCents).toBe(6000)
  })

  it('falls back to the closest condition and flags the value approximate', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-damaged-box'), [
      snapshot({ source: 'ebay', figureCents: 6500 }),
      snapshot({ source: 'cardmarket', kind: 'source-aggregate', kairosCondition: null, figureCents: 15123 }),
    ], now)
    expect(valuation.approximate).toBe(true)
    expect(valuation.usedCondition).toBe('sealed-new')
    expect(valuation.perSource.map(entry => entry.source).sort()).toEqual(['cardmarket', 'ebay'])
  })

  it('prefers the worse condition on a distance tie', () => {
    const valuation = estimateStockItemValue(sealedProduct('opened-complete'), [
      snapshot({ kairosCondition: 'sealed-damaged-box', figureCents: 5000 }),
      snapshot({ kairosCondition: 'opened-incomplete', figureCents: 3000 }),
    ], now)
    expect(valuation.usedCondition).toBe('opened-incomplete')
    expect(valuation.valueCents).toBe(3000)
  })

  it('ignores aggregates for categories other than pokemon-sealed', () => {
    const valuation = estimateStockItemValue(
      { category: 'toy', condition: 'good', gradingCompany: null, grade: null },
      [snapshot({ source: 'cardmarket', kind: 'source-aggregate', kairosCondition: null, figureCents: 4000 })],
      now,
    )
    expect(valuation.valueCents).toBeNull()
    expect(valuation.usedCondition).toBeNull()
    expect(valuation.perSource).toEqual([])
  })

  it('never uses tcgdex or pokemontcg', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ source: 'tcgdex', kind: 'source-aggregate', kairosCondition: null, figureCents: 100 }),
      snapshot({ source: 'pokemontcg', kind: 'source-aggregate', kairosCondition: null, figureCents: 100 }),
    ], now)
    expect(valuation.valueCents).toBeNull()
  })

  it('falls back to the closest grade of the same company, lower grade on a tie, never across companies', () => {
    const closest = estimateStockItemValue(gradedCard('PSA', '10'), [
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PSA', grade: '9', figureCents: 20000 }),
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PCA', grade: '10', figureCents: 90000 }),
    ], now)
    expect(closest.valueCents).toBe(20000)
    expect(closest.approximate).toBe(true)
    expect(closest.usedCondition).toBe('PSA 9')

    const onlyOtherCompany = estimateStockItemValue(gradedCard('PSA', '10'), [
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PCA', grade: '10', figureCents: 90000 }),
    ], now)
    expect(onlyOtherCompany.valueCents).toBeNull()

    const tie = estimateStockItemValue(gradedCard('PSA', '9'), [
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PSA', grade: '10', figureCents: 90000 }),
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PSA', grade: '8', figureCents: 10000 }),
    ], now)
    expect(tie.usedCondition).toBe('PSA 8')
  })

  it('matches the grading company whatever its case or spacing', () => {
    const valuation = estimateStockItemValue(gradedCard('psa', '10'), [
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PSA', grade: '10', figureCents: 90000 }),
    ], now)
    expect(valuation).toMatchObject({ valueCents: 90000, approximate: false })
  })

  it('compares grades numerically and matches an exact grade without approximation', () => {
    const valuation = estimateStockItemValue(gradedCard('BGS', '9.5'), [
      snapshot({ kairosCondition: 'graded', gradingCompany: 'BGS', grade: '10', figureCents: 90000 }),
      snapshot({ kairosCondition: 'graded', gradingCompany: 'BGS', grade: '9.5', figureCents: 30000 }),
    ], now)
    expect(valuation.valueCents).toBe(30000)
    expect(valuation.approximate).toBe(false)
  })

  it('ignores aggregates for graded cards', () => {
    const valuation = estimateStockItemValue(gradedCard('PSA', '10'), [
      snapshot({ source: 'cardmarket', kind: 'source-aggregate', kairosCondition: null, figureCents: 4000 }),
    ], now)
    expect(valuation.valueCents).toBeNull()
  })

  it('ignores a snapshot older than 7 days and keeps one at 6 days 23 hours', () => {
    const tooOld = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ observedAt: daysAgo(7, 1) }),
    ], now)
    expect(tooOld.valueCents).toBeNull()

    const stillFresh = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ observedAt: new Date(now.getTime() - (6 * 24 + 23) * 60 * 60 * 1000) }),
    ], now)
    expect(stillFresh.valueCents).toBe(1000)

    const exactlySevenDays = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ observedAt: daysAgo(7) }),
    ], now)
    expect(exactlySevenDays.valueCents).toBe(1000)
  })

  it('returns no value for a graded item without a numeric grade or without a company', () => {
    const gradedSnapshots = [
      snapshot({ kairosCondition: 'graded', gradingCompany: 'PSA', grade: '9', figureCents: 20000 }),
      snapshot({ kairosCondition: 'graded', gradingCompany: null, grade: '9', figureCents: 5000 }),
    ]
    const withoutGrade = estimateStockItemValue({ ...gradedCard('PSA', '10'), grade: null }, gradedSnapshots, now)
    expect(withoutGrade.valueCents).toBeNull()
    expect(withoutGrade.perSource).toEqual([])
    expect(estimateStockItemValue(gradedCard('PSA', 'abc'), gradedSnapshots, now).valueCents).toBeNull()
    expect(estimateStockItemValue({ ...gradedCard('PSA', '9'), gradingCompany: null }, gradedSnapshots, now).valueCents).toBeNull()
  })

  it('breaks a tie between snapshots observed at the same instant with the lower figure, whatever the input order', () => {
    const observedAt = daysAgo(1)
    const high = snapshot({ observedAt, figureCents: 9000 })
    const low = snapshot({ observedAt, figureCents: 6000 })
    expect(estimateStockItemValue(sealedProduct('sealed-new'), [high, low], now).valueCents).toBe(6000)
    expect(estimateStockItemValue(sealedProduct('sealed-new'), [low, high], now).valueCents).toBe(6000)
  })

  it('keeps the newest figure in the window when the latest refresh of a source found none', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ figureCents: 6000, observedAt: daysAgo(3) }),
      snapshot({ figureCents: null, observedAt: daysAgo(1) }),
    ], now)
    expect(valuation.valueCents).toBe(6000)
    expect(valuation.perSource).toEqual([{ source: 'ebay', figureCents: 6000, observedAt: daysAgo(3) }])
  })

  it('falls back to the closest condition of the toy scale and flags the value approximate', () => {
    const valuation = estimateStockItemValue(
      { category: 'toy', condition: 'good', gradingCompany: null, grade: null },
      [snapshot({ kairosCondition: 'very-good', figureCents: 2500 })],
      now,
    )
    expect(valuation).toMatchObject({ valueCents: 2500, approximate: true, usedCondition: 'very-good' })
  })

  it('takes the median of the manual and the listing figures of one source', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ source: 'vinted', kind: 'manual', figureCents: 7000, observedAt: daysAgo(2) }),
      snapshot({ source: 'vinted', kind: 'active', figureCents: 9000, observedAt: daysAgo(1) }),
    ], now)
    expect(valuation.perSource).toEqual([{ source: 'vinted', figureCents: 8000, observedAt: daysAgo(1) }])
    expect(valuation.valueCents).toBe(8000)
  })

  it('ignores snapshots without a figure', () => {
    const valuation = estimateStockItemValue(sealedProduct('sealed-new'), [
      snapshot({ figureCents: null }),
    ], now)
    expect(valuation.valueCents).toBeNull()
  })
})
