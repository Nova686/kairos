import { describe, expect, it } from 'vitest'
import {
  buildHistoryChartData,
  buildPriceColumns,
  buildPriceRows,
  describeRetainedPrice,
  formatParisDateTime,
  type PriceHistoryPointView,
  type PriceOverviewCellView,
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
  figureCents: 10000,
  ...overrides,
})

describe('describeRetainedPrice', () => {
  const columns = buildPriceColumns('pokemon-sealed', [])

  it('retains the median of the fresh source figures of the column and highlights the closest cell', () => {
    const rows = buildPriceRows([
      cell({ source: 'ebay', figureCents: 15000, snapshotId: 'ebay-cell' }),
      cell({ source: 'cardmarket', figureCents: 17000, snapshotId: 'cardmarket-cell' }),
      cell({ source: 'vinted', figureCents: 14000, snapshotId: 'vinted-cell' }),
    ], columns)

    expect(describeRetainedPrice(rows, 0)).toEqual({ retainedCents: 15000, sourceCount: 3, highlightedSnapshotId: 'ebay-cell' })
  })

  it('ignores stale cells', () => {
    const rows = buildPriceRows([
      cell({ source: 'ebay', figureCents: 15000, snapshotId: 'ebay-cell' }),
      cell({ source: 'cardmarket', figureCents: 90000, snapshotId: 'cardmarket-cell', isStale: true }),
    ], columns)

    expect(describeRetainedPrice(rows, 0)).toEqual({ retainedCents: 15000, sourceCount: 1, highlightedSnapshotId: 'ebay-cell' })
  })

  it('retains nothing when the column has no fresh price', () => {
    const rows = buildPriceRows([cell({ isStale: true })], columns)

    expect(describeRetainedPrice(rows, 0)).toBeNull()
    expect(describeRetainedPrice(rows, 3)).toBeNull()
    expect(describeRetainedPrice(rows, -1)).toBeNull()
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
