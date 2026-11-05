<template>
  <div class="stock-filters">
    <v-text-field
      v-model="search"
      class="stock-filters__search"
      label="Rechercher"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="comfortable"
      clearable
      hide-details
    />
    <v-chip-group
      v-model="selectedCategory"
      class="stock-filters__categories kairos-hidden-scrollbar"
      aria-label="Catégorie"
      mandatory
      selected-class="kairos-filter-chip--selected"
    >
      <v-chip
        v-for="categoryChip in categoryChips"
        :key="categoryChip.value"
        class="kairos-filter-chip"
        :value="categoryChip.value"
        variant="outlined"
      >
        {{ categoryChip.title }}
      </v-chip>
    </v-chip-group>
    <div class="stock-filters__selects">
      <v-select
        v-model="status"
        label="Statut"
        :items="statusOptions"
        variant="outlined"
        density="comfortable"
        clearable
        hide-details
      />
      <v-select
        v-model="locationId"
        label="Lieu"
        prepend-inner-icon="mdi-map-marker-outline"
        :items="locationOptions"
        variant="outlined"
        density="comfortable"
        clearable
        hide-details
      />
      <v-select
        v-model="sortKey"
        label="Tri"
        prepend-inner-icon="mdi-swap-vertical"
        :items="stockSortOptions"
        variant="outlined"
        density="comfortable"
        hide-details
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { productCategories, productCategoryLabels } from '~~/shared/catalogue/product-category'
import type { LocationRow } from '~~/shared/stock/stock-item-row'
import { stockItemStatuses, stockItemStatusLabels, type StockItemStatus } from '~~/shared/stock/stock-item-status'
import { stockSortOptions, type StockSortKey } from '~/utils/stock-list-view'

const props = defineProps({
  locations: { type: Array as PropType<LocationRow[]>, required: true },
})

const search = defineModel<string>('search', { required: true })
const status = defineModel<StockItemStatus | null>('status', { required: true })
const category = defineModel<string | null>('category', { required: true })
const locationId = defineModel<string | null>('locationId', { required: true })
const sortKey = defineModel<StockSortKey>('sortKey', { required: true })

const allCategoriesValue = 'all'

const statusOptions = stockItemStatuses.map(status => ({ value: status, title: stockItemStatusLabels[status] }))
const categoryChips = [
  { value: allCategoriesValue, title: 'Tout' },
  ...productCategories.map(category => ({ value: category, title: productCategoryLabels[category] })),
]
const locationOptions = computed(() => props.locations.map(location => ({ value: location.id, title: location.label })))

const selectedCategory = computed({
  get: () => category.value ?? allCategoriesValue,
  set: (chosenCategory: string | undefined) => {
    category.value = chosenCategory === undefined || chosenCategory === allCategoriesValue ? null : chosenCategory
  },
})
</script>

<style scoped>
.stock-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.stock-filters__search {
  flex: 1 1 100%;
  min-width: 0;
}

.stock-filters__categories {
  flex: 1 1 100%;
  min-width: 0;
}

.stock-filters__selects {
  display: grid;
  flex: 1 1 100%;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

@media (min-width: 960px) {
  .stock-filters__search {
    flex: 0 1 300px;
  }

  .stock-filters__categories {
    flex: 1 1 0;
  }

  .stock-filters__selects {
    flex: 1 1 100%;
    grid-template-columns: repeat(3, minmax(0, 220px));
  }
}
</style>
