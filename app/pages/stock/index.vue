<template>
  <div class="stock-page">
    <div class="stock-page__heading">
      <div>
        <h1 class="kairos-page-title">
          Stock
        </h1>
        <p
          v-if="heldStockSummary.heldCount > 0"
          class="kairos-page-subtitle"
        >
          {{ pluralizeFrench(heldStockSummary.heldCount, 'exemplaire') }}
          · {{ formatEuros(heldStockSummary.investedCents) }} investis
          · valeur {{ formatEuros(heldStockSummary.valuedCents) }}
          <template v-if="heldStockSummary.unpricedCount > 0">
            · {{ heldStockSummary.unpricedCount }} sans prix
          </template>
        </p>
      </div>
      <div class="stock-page__actions">
        <v-btn
          variant="outlined"
          :loading="isRefreshingAll"
          @click="refreshAllPrices"
        >
          Relever tout mon stock
        </v-btn>
        <v-btn
          to="/ajouter"
          color="primary"
          prepend-icon="mdi-plus"
          class="d-none d-md-inline-flex"
        >
          Ajouter un achat
        </v-btn>
      </div>
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
      v-model:sort-key="sortKey"
      :locations="locations"
    />
    <v-progress-linear
      v-if="pending"
      indeterminate
    />
    <StockItemList
      :list-rows="listRows"
      :table-headers="tableHeaders"
    />
  </div>
</template>

<script setup lang="ts">
import type { StockSortKey } from '~/utils/stock-list-view'

const { filters, stockItems, locations, locationLabelsById, pending } = useStockItems()
const { valuationsByStockItemId, refreshAllPrices, refreshMessage, errorMessage, isRefreshingAll } = useStockValue()

const sortKey = ref<StockSortKey>('recent')

const { listRows, heldStockSummary, tableHeaders } = useStockItemList(
  () => stockItems.value,
  () => locationLabelsById.value,
  () => valuationsByStockItemId.value,
  () => sortKey.value,
)
</script>

<style scoped>
.stock-page__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.stock-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
