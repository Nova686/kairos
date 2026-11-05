<template>
  <p
    v-if="chartData.datasets.length === 0"
    class="price-history-chart__empty"
  >
    Aucun historique pour cet état.
  </p>
  <div
    v-else
    class="price-history-chart"
  >
    <Line
      :data="lineChartData"
      :options="lineChartOptions"
      aria-label="Historique des prix par source"
      role="img"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Chart as ChartJs,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { PriceChartData } from '~/utils/price-overview-view'

ChartJs.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps({
  chartData: { type: Object as PropType<PriceChartData>, required: true },
})

const lineChartData = computed(() => ({ datasets: buildLineChartDatasets(props.chartData) }))
const lineChartOptions = buildLineChartOptions()
</script>

<style scoped>
.price-history-chart {
  position: relative;
  height: 240px;
}

.price-history-chart__empty {
  margin: 0;
  color: var(--kairos-text-secondary);
}

@media (min-width: 960px) {
  .price-history-chart {
    height: 300px;
  }
}
</style>
