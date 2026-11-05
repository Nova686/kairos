import { describe, expect, it } from 'vitest'
import {
  hasEnoughDaysToDrawCurve,
  buildHistoryChartData,
  dayNumberOf,
  formatDayNumber,
  buildPriceColumns,
  buildPriceRows,
  chooseDefaultColumnKey,
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

describe('buildPriceColumns', () => {
  it('returns one column per condition of the category, in scale order', () => {
    const columns = buildPriceColumns('pokemon-sealed', [])

    expect(columns.map(column => column.key)).toEqual(['sealed-new', 'sealed-damaged-box', 'opened-complete', 'opened-incomplete'])
    expect(columns[0]).toMatchObject({ label: 'neuf scellé', condition: 'sealed-new', gradingCompany: null, grade: null })
  })

  it('returns one column per grading company and grade found, best grade first within a company', () => {
    const columns = buildPriceColumns('graded-card', [
      cell({ condition: 'graded', gradingCompany: 'PSA', grade: '9' }),
      cell({ condition: 'graded', gradingCompany: 'PSA', grade: '10', source: 'vinted' }),
      cell({ condition: 'graded', gradingCompany: 'CGC', grade: '9.5' }),
      cell({ condition: 'graded', gradingCompany: 'PSA', grade: '9', source: 'vinted' }),
    ])

    expect(columns.map(column => column.label)).toEqual(['CGC 9.5', 'PSA 10', 'PSA 9'])
    expect(columns[1]).toMatchObject({ key: 'graded|PSA|10', condition: 'graded', gradingCompany: 'PSA', grade: '10' })
  })

  it('has no column for a graded card without any snapshot', () => {
    expect(buildPriceColumns('graded-card', [])).toEqual([])
  })
})

describe('buildPriceRows', () => {
  it('places each cell under its column and leaves the others empty', () => {
    const columns = buildPriceColumns('pokemon-sealed', [])
    const ebayCell = cell({ figureCents: 9000 })

    const rows = buildPriceRows([ebayCell], columns)

    expect(rows.map(row => row.label)).toEqual(['eBay', 'Cardmarket', 'Vinted', 'Leboncoin', 'Autre'])
    expect(rows[0]!.cells).toEqual([ebayCell, null, null, null])
    expect(rows[1]!.cells).toEqual([null, null, null, null])
  })

  it('matches graded cells on company and grade', () => {
    const psaTen = cell({ source: 'vinted', condition: 'graded', gradingCompany: 'PSA', grade: '10' })
    const columns = buildPriceColumns('graded-card', [psaTen])

    const rows = buildPriceRows([psaTen], columns)

    expect(rows[2]!.cells).toEqual([psaTen])
  })
})

describe('buildHistoryChartData', () => {
  it('builds one dataset per source for the selected column, in euros, over the sorted days', () => {
    const columns = buildPriceColumns('pokemon-sealed', [])

    const chartData = buildHistoryChartData([
      point({ observedOn: '2026-11-02', figureCents: 9500 }),
      point({ observedOn: '2026-11-01', figureCents: 9000 }),
      point({ source: 'cardmarket', observedOn: '2026-11-02', figureCents: 12000 }),
      point({ condition: 'opened-complete', observedOn: '2026-11-01', figureCents: 500 }),
    ], columns[0]!)

    expect(chartData.datasets.map(dataset => [dataset.label, dataset.data])).toEqual([
      ['eBay', [{ x: dayNumberOf('2026-11-01'), y: 90 }, { x: dayNumberOf('2026-11-02'), y: 95 }]],
      ['Cardmarket', [{ x: dayNumberOf('2026-11-02'), y: 120 }]],
    ])
    expect(chartData.datasets.every(dataset => !dataset.spanGaps)).toBe(true)
  })

  it('places points proportionally to the real days, leaving gaps where days are missing', () => {
    const columns = buildPriceColumns('pokemon-sealed', [])

    const chartData = buildHistoryChartData([
      point({ observedOn: '2026-10-01' }),
      point({ observedOn: '2026-11-01' }),
    ], columns[0]!)

    const dayNumbers = chartData.datasets[0]!.data.map(chartPoint => chartPoint.x)
    expect(dayNumbers[1]! - dayNumbers[0]!).toBe(31)
    expect(formatDayNumber(dayNumbers[0]!)).toBe('01/10/2026')
  })

  it('has no dataset without a selected column', () => {
    expect(buildHistoryChartData([point({})], null)).toEqual({ datasets: [] })
  })
})

describe('chooseDefaultColumnKey', () => {
  const columns = buildPriceColumns('pokemon-sealed', [])

  it('prefers the requested condition when it is a column', () => {
    expect(chooseDefaultColumnKey(columns, 'opened-complete')).toBe('opened-complete')
  })

  it('falls back to sealed-new, then to the first column', () => {
    expect(chooseDefaultColumnKey(columns, 'unknown')).toBe('sealed-new')
    expect(chooseDefaultColumnKey(buildPriceColumns('toy', []), null)).toBe('new-with-tags')
  })

  it('has no default without columns', () => {
    expect(chooseDefaultColumnKey([], 'sealed-new')).toBeNull()
  })
})

describe('hasEnoughDaysToDrawCurve', () => {
  const datasetOf = (days: number[]) => ({
    label: 'eBay',
    data: days.map(day => ({ x: day, y: 10 })),
    borderColor: '#000',
    backgroundColor: '#000',
    spanGaps: false,
  })

  it('refuses an empty chart and a single day', () => {
    expect(hasEnoughDaysToDrawCurve({ datasets: [] })).toBe(false)
    expect(hasEnoughDaysToDrawCurve({ datasets: [datasetOf([20000])] })).toBe(false)
    expect(hasEnoughDaysToDrawCurve({ datasets: [datasetOf([20000]), datasetOf([20000])] })).toBe(false)
  })

  it('accepts two distinct days, within one series or across series', () => {
    expect(hasEnoughDaysToDrawCurve({ datasets: [datasetOf([20000, 20001])] })).toBe(true)
    expect(hasEnoughDaysToDrawCurve({ datasets: [datasetOf([20000]), datasetOf([20003])] })).toBe(true)
  })
})
