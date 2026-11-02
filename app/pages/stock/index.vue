<template>
  <div>
    <div class="stock-page__heading">
      <h1 class="text-h5">
        Stock
      </h1>
      <v-btn
        :loading="isRefreshingAll"
        @click="refreshAllPrices"
      >
        Relever tout mon stock
      </v-btn>
    </div>
    <v-alert
      v-if="refreshMessage"
      type="info"
      class="mb-4"
      role="status"
    >
      {{ refreshMessage }}
    </v-alert>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="mb-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <StockFilters
      v-model:search="filters.search"
      v-model:status="filters.status"
      v-model:category="filters.category"
      v-model:location-id="filters.locationId"
      :locations="locations"
    />
    <v-progress-linear
      v-if="pending"
      indeterminate
    />
    <StockItemList
      :stock-items="stockItems"
      :location-labels-by-id="locationLabelsById"
      :valuations-by-stock-item-id="valuationsByStockItemId"
    />
  </div>
</template>

<script setup lang="ts">
const { filters, stockItems, locations, locationLabelsById, pending } = useStockItems()
const { valuationsByStockItemId, refreshAllPrices, refreshMessage, errorMessage, isRefreshingAll } = useStockValue()
</script>

<style scoped>
.stock-page__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
