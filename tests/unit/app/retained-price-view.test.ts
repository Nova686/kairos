import { describe, expect, it } from 'vitest'
import {
  buildHistoryChartData,
  buildPriceColumns,
  buildPriceRows,
  findRetainedCellSnapshotId,
  findRetainedValue,
  formatParisDateTime,
  type PriceHistoryPointView,
  type PriceOverviewCellView,
  type RetainedValueView,
} from '../../../app/utils/price-overview-view.ts'

const cell = (overrides: Partial<PriceOverviewCellView>): PriceOverviewCellView => ({
  source: 'ebay',
  condition: 'sealed-new',
  gradingCompany: null,
  grade: null,
  figureCents: 10000,
  listingCount: 3,
  observedAt: '2026-11-01T10:00:00.000Z',
  snapshotId: 'snapshot-1',
  isStale: false,
  listings: [],
  ...overrides,
})

const point = (overrides: Partial<PriceHistoryPointView>): PriceHistoryPointView => ({
  source: 'ebay',
  condition: 'sealed-new',
  gradingCompany: null,
  grade: null,
  observedOn: '2026-11-01',
  observedAt: '2026-11-01T10:00:00.000Z',
  figureCents: 10000,
  ...overrides,
})

const retained = (overrides: Partial<RetainedValueView>): RetainedValueView => ({
  condition: 'sealed-new',
  gradingCompany: null,
  grade: null,
  valueCents: 15000,
  approximate: false,
  usedCondition: 'sealed-new',
  ...overrides,
})

describe('findRetainedValue', () => {
  it('finds the server retained value of the selected column, graded ones by company and grade', () => {
    const sealedColumns = buildPriceColumns('pokemon-sealed', [])
    expect(findRetainedValue([retained({ condition: 'opened-complete', valueCents: 1 }), retained({})], sealedColumns[0]!)?.valueCents).toBe(15000)

    const gradedCell = cell({ condition: 'graded', gradingCompany: 'PSA', grade: '10' })
    const gradedColumns = buildPriceColumns('graded-card', [gradedCell])
    expect(findRetainedValue([retained({ condition: 'graded', gradingCompany: 'PSA', grade: '10', valueCents: 50000 })], gradedColumns[0]!)?.valueCents).toBe(50000)
  })

  it('finds nothing without a selected column or a matching entry', () => {
    expect(findRetainedValue([retained({})], null)).toBeNull()
    expect(findRetainedValue([], buildPriceColumns('pokemon-sealed', [])[0]!)).toBeNull()
  })
})

describe('findRetainedCellSnapshotId', () => {
  const columns = buildPriceColumns('pokemon-sealed', [])
  const rows = buildPriceRows([
    cell({ source: 'ebay', figureCents: 15000, snapshotId: 'ebay-cell' }),
    cell({ source: 'cardmarket', figureCents: 17000, snapshotId: 'cardmarket-cell' }),
    cell({ source: 'vinted', figureCents: 15100, snapshotId: 'stale-cell', isStale: true }),
  ], columns)

  it('highlights the fresh cell closest to the retained value', () => {
    expect(findRetainedCellSnapshotId(rows, 0, retained({ valueCents: 16000 }))).toBe('ebay-cell')
    expect(findRetainedCellSnapshotId(rows, 0, retained({ valueCents: 16600 }))).toBe('cardmarket-cell')
  })

  it('highlights nothing for an approximate, missing or absent retained value', () => {
    expect(findRetainedCellSnapshotId(rows, 0, retained({ approximate: true }))).toBeNull()
    expect(findRetainedCellSnapshotId(rows, 0, retained({ valueCents: null }))).toBeNull()
    expect(findRetainedCellSnapshotId(rows, 0, null)).toBeNull()
    expect(findRetainedCellSnapshotId(rows, 3, retained({}))).toBeNull()
  })
})

describe('price source colours', () => {
  it('gives each source row the Coffre source colour', () => {
    const rows = buildPriceRows([], buildPriceColumns('pokemon-sealed', []))
    expect(rows.map(row => row.color).slice(0, 4)).toEqual(['#6fa8dc', '#4cc38a', '#a993f0', '#e3a44a'])
  })

  it('draws the history lines in the source colours', () => {
    const columns = buildPriceColumns('pokemon-sealed', [])
    const chartData = buildHistoryChartData([point({}), point({ source: 'vinted' })], columns[0]!)
    expect(chartData.datasets.map(dataset => dataset.borderColor)).toEqual(['#6fa8dc', '#a993f0'])
  })
})

describe('formatParisDateTime', () => {
  it('shows the Paris calendar day and the Paris hour', () => {
    expect(formatParisDateTime('2026-11-03T07:12:00.000Z')).toMatch(/^03\/11\/2026.*08:12$/)
  })
})
