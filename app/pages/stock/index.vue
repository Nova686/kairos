<template>
  <div>
    <h1 class="text-h5 mb-4">
      Stock
    </h1>
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
    />
  </div>
</template>

<script setup lang="ts">
const { filters, stockItems, locations, locationLabelsById, pending } = useStockItems()
</script>
