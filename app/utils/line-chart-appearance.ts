import type { ChartDataset, ChartOptions, ScriptableContext } from 'chart.js'
import {
  brandBorderColor,
  brandSecondaryTextColor,
  brandSurfaceVariantColor,
  brandTextColor,
} from '../../shared/theme/brand-colors.ts'
import { formatDayNumber, type PriceChartData } from './price-overview-view.ts'

const figureFontFamily = '"IBM Plex Mono", ui-monospace, monospace'
const bodyFontFamily = '"IBM Plex Sans", system-ui, sans-serif'
const areaTopOpacitySuffix = '47'
const areaBottomOpacitySuffix = '00'
const dashPattern = [5, 5]
const denseSeriesPointCount = 30

const euroAmountFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const buildAreaGradient = (context: ScriptableContext<'line'>, lineColor: string): CanvasGradient | string => {
  const { chart } = context
  if (!chart.chartArea) {
    return 'transparent'
  }
  const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom)
  gradient.addColorStop(0, `${lineColor}${areaTopOpacitySuffix}`)
  gradient.addColorStop(1, `${lineColor}${areaBottomOpacitySuffix}`)
  return gradient
}

export const buildLineChartDatasets = (chartData: PriceChartData): ChartDataset<'line', { x: number, y: number }[]>[] =>
  chartData.datasets.map(priceDataset => ({
    label: priceDataset.label,
    data: priceDataset.data,
    borderColor: priceDataset.borderColor,
    backgroundColor: priceDataset.hasAreaFill
      ? (context: ScriptableContext<'line'>) => buildAreaGradient(context, priceDataset.borderColor)
      : priceDataset.backgroundColor,
    borderWidth: 2,
    borderDash: priceDataset.isDashed ? dashPattern : [],
    fill: priceDataset.hasAreaFill === true,
    spanGaps: priceDataset.spanGaps,
    tension: 0.2,
    pointRadius: priceDataset.data.length > denseSeriesPointCount ? 0 : 3,
    pointHoverRadius: 5,
    pointBackgroundColor: '#131922',
    pointBorderColor: priceDataset.borderColor,
    pointBorderWidth: 2,
  }))

export type LineChartSeriesDays = 'shared-days' | 'own-days'

const tooltipModeBySeriesDays: Record<LineChartSeriesDays, 'index' | 'x'> = {
  'shared-days': 'index',
  'own-days': 'x',
}

export const buildLineChartOptions = (seriesDays: LineChartSeriesDays): ChartOptions<'line'> => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: tooltipModeBySeriesDays[seriesDays], intersect: false },
  scales: {
    x: {
      type: 'linear',
      border: { display: false },
      grid: { color: brandBorderColor },
      ticks: {
        color: brandSecondaryTextColor,
        font: { family: figureFontFamily, size: 11 },
        maxTicksLimit: 8,
        precision: 0,
        callback: tickValue => formatDayNumber(Number(tickValue)),
      },
    },
    y: {
      border: { display: false },
      grid: { color: brandBorderColor },
      ticks: {
        color: brandSecondaryTextColor,
        font: { family: figureFontFamily, size: 11 },
        callback: tickValue => euroAmountFormatter.format(Number(tickValue)),
      },
    },
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: brandSecondaryTextColor,
        font: { family: bodyFontFamily, size: 12 },
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
      },
    },
    tooltip: {
      backgroundColor: brandSurfaceVariantColor,
      borderColor: brandBorderColor,
      borderWidth: 1,
      titleColor: brandSecondaryTextColor,
      bodyColor: brandTextColor,
      titleFont: { family: bodyFontFamily },
      bodyFont: { family: figureFontFamily },
      callbacks: {
        title: tooltipItems => [...new Set(tooltipItems.map(tooltipItem => formatDayNumber(Number(tooltipItem.parsed.x))))].join(', '),
        label: tooltipItem => `${tooltipItem.dataset.label} : ${euroAmountFormatter.format(Number(tooltipItem.parsed.y))}`,
      },
    },
  },
})
