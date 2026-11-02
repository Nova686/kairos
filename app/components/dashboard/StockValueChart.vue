<template>
  <p v-if="chartData.datasets.length === 0">
    Pas encore d’historique : le premier relevé quotidien arrive à 6 h.
  </p>
  <ClientOnly v-else>
    <div class="stock-value-chart">
      <Line
        :data="chartData"
        :options="chartOptions"
        aria-label="Coût et valeur du stock dans le temps"
        role="img"
      />
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import {
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

ChartJs.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

defineProps({
  chartData: { type: Object as PropType<PriceChartData>, required: true },
})

const euroAmountFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: 'linear',
      ticks: { maxTicksLimit: 8, precision: 0, callback: tickValue => formatDayNumber(Number(tickValue)) },
    },
    y: {
      ticks: { callback: tickValue => euroAmountFormatter.format(Number(tickValue)) },
    },
  },
  plugins: {
    tooltip: {
      callbacks: {
        title: tooltipItems => tooltipItems.map(tooltipItem => formatDayNumber(Number(tooltipItem.parsed.x))).join(', '),
        label: tooltipItem => `${tooltipItem.dataset.label} : ${euroAmountFormatter.format(Number(tooltipItem.parsed.y))}`,
      },
    },
  },
}
</script>

<style scoped>
.stock-value-chart {
  height: 280px;
  position: relative;
}
</style>
