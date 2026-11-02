<template>
  <p v-if="chartData.datasets.length === 0">
    Aucun historique pour cet état.
  </p>
  <div
    v-else
    class="price-history-chart"
  >
    <Line
      :data="chartData"
      :options="chartOptions"
      aria-label="Historique des prix par source"
      role="img"
    />
  </div>
</template>

<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJs,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { PriceChartData } from '~/utils/price-overview-view'

ChartJs.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

defineProps({
  chartData: { type: Object as PropType<PriceChartData>, required: true },
})

const euroAmountFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      ticks: { callback: tickValue => euroAmountFormatter.format(Number(tickValue)) },
    },
  },
  plugins: {
    tooltip: {
      callbacks: {
        label: tooltipItem => `${tooltipItem.dataset.label} : ${euroAmountFormatter.format(Number(tooltipItem.parsed.y))}`,
      },
    },
  },
}
</script>

<style scoped>
.price-history-chart {
  height: 320px;
  position: relative;
}
</style>
