<template>
  <div>
    <h1 class="text-h5 mb-4">
      Tableau de bord
    </h1>
    <template v-if="overview">
      <StockValueSummary :stock-value="overview.stockValue" />
      <h2 class="text-h6 mt-8 mb-2">
        Coût et valeur dans le temps
      </h2>
      <StockValueChart :chart-data="chartData" />
      <RecentActivity
        class="mt-8"
        :overview="overview"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
const { overview, chartData } = useDashboardOverview()
</script>
