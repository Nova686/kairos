<template>
  <div class="stock-filters">
    <v-text-field
      v-model="search"
      label="Rechercher"
      prepend-inner-icon="mdi-magnify"
      clearable
      hide-details
    />
    <v-select
      v-model="status"
      label="Statut"
      :items="statusOptions"
      clearable
      hide-details
    />
    <v-select
      v-model="category"
      label="Catégorie"
      :items="categoryOptions"
      clearable
      hide-details
    />
    <v-select
      v-model="locationId"
      label="Lieu"
      :items="locationOptions"
      clearable
      hide-details
    />
  </div>
</template>

<script setup lang="ts">
import { productCategories, productCategoryLabels } from '~~/shared/catalogue/product-category'
import type { LocationRow } from '~~/shared/stock/stock-item-row'
import { stockItemStatuses, stockItemStatusLabels, type StockItemStatus } from '~~/shared/stock/stock-item-status'

const props = defineProps({
  locations: { type: Array as PropType<LocationRow[]>, required: true },
})

const search = defineModel<string>('search', { required: true })
const status = defineModel<StockItemStatus | null>('status', { required: true })
const category = defineModel<string | null>('category', { required: true })
const locationId = defineModel<string | null>('locationId', { required: true })

const statusOptions = stockItemStatuses.map(status => ({ value: status, title: stockItemStatusLabels[status] }))
const categoryOptions = productCategories.map(category => ({ value: category, title: productCategoryLabels[category] }))
const locationOptions = computed(() => props.locations.map(location => ({ value: location.id, title: location.label })))
</script>

<style scoped>
.stock-filters {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: 16px;
}
</style>
