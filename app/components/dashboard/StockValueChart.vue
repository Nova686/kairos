<template>
  <v-card class="stock-value-chart">
    <h2 class="kairos-card-title">
      Coût et valeur dans le temps
    </h2>
    <p
      v-if="chartData.datasets.length === 0"
      class="stock-value-chart__empty"
    >
      Pas encore d’historique : le premier relevé quotidien arrive à 6 h.
    </p>
    <ClientOnly v-else>
      <div class="stock-value-chart__canvas">
        <Line
          :data="lineChartData"
          :options="lineChartOptions"
          aria-label="Coût et valeur du stock dans le temps"
          role="img"
        />
      </div>
      <template #fallback>
        <v-progress-linear indeterminate />
      </template>
    </ClientOnly>
    <p
      v-if="lastSnapshotOn"
      class="kairos-label stock-value-chart__footnote"
    >
      Dernier relevé quotidien : {{ formatDayNumber(dayNumberOf(lastSnapshotOn)) }}
    </p>
  </v-card>
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
  lastSnapshotOn: { type: String as PropType<string | null>, default: null },
})

const lineChartData = computed(() => ({ datasets: buildLineChartDatasets(props.chartData) }))
const lineChartOptions = buildLineChartOptions()
</script>

<style scoped>
.stock-value-chart {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  min-width: 0;
}

.stock-value-chart__canvas {
  position: relative;
  height: 220px;
}

.stock-value-chart__empty {
  margin: 0;
  color: var(--kairos-text-secondary);
}

.stock-value-chart__footnote {
  margin: 0;
  text-transform: none;
  letter-spacing: 0;
}

@media (min-width: 960px) {
  .stock-value-chart {
    padding: 18px;
  }

  .stock-value-chart__canvas {
    height: 280px;
  }
}
</style>
