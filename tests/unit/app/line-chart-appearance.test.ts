import { describe, expect, it } from 'vitest'
import { buildLineChartDatasets } from '../../../app/utils/line-chart-appearance.ts'
import type { PriceChartData } from '../../../app/utils/price-overview-view.ts'

const dataset = (overrides: Partial<PriceChartData['datasets'][number]>): PriceChartData['datasets'][number] => ({
  label: 'Valeur',
  data: [{ x: 1, y: 10 }, { x: 2, y: 12 }],
  borderColor: '#6fa8dc',
  backgroundColor: '#6fa8dc',
  spanGaps: false,
  ...overrides,
})

describe('buildLineChartDatasets', () => {
  it('draws a plain line in its source colour with visible points', () => {
    const [lineDataset] = buildLineChartDatasets({ datasets: [dataset({})] })
    expect(lineDataset).toMatchObject({ borderColor: '#6fa8dc', backgroundColor: '#6fa8dc', fill: false, borderDash: [], pointRadius: 3 })
  })

  it('dashes the line when asked', () => {
    const [lineDataset] = buildLineChartDatasets({ datasets: [dataset({ isDashed: true })] })
    expect(lineDataset!.borderDash).toEqual([5, 5])
  })

  it('fills the area under the line through a scriptable gradient', () => {
    const [lineDataset] = buildLineChartDatasets({ datasets: [dataset({ hasAreaFill: true })] })
    expect(lineDataset!.fill).toBe(true)
    expect(typeof lineDataset!.backgroundColor).toBe('function')
  })

  it('hides the points of a dense series', () => {
    const denseSeries = Array.from({ length: 60 }, (_, index) => ({ x: index, y: index }))
    const [lineDataset] = buildLineChartDatasets({ datasets: [dataset({ data: denseSeries })] })
    expect(lineDataset!.pointRadius).toBe(0)
  })
})
