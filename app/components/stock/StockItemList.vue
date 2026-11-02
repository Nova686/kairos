<template>
  <p v-if="listRows.length === 0">
    Aucun exemplaire en stock.
  </p>
  <div
    v-else-if="isMobile"
    class="stock-item-list"
  >
    <v-card
      v-for="listRow in listRows"
      :key="listRow.id"
      :to="`/stock/${listRow.id}`"
    >
      <div class="stock-item-list__card">
        <v-img
          v-if="listRow.productImageUrl"
          :src="listRow.productImageUrl"
          :alt="listRow.productName"
          width="64"
          height="64"
          cover
        />
        <div>
          <div class="text-subtitle-1">
            {{ listRow.productName }}
          </div>
          <div>{{ listRow.conditionText }} · {{ listRow.locationText }}</div>
          <div>{{ listRow.statusText }} · {{ listRow.purchasePriceText }}</div>
        </div>
      </div>
    </v-card>
  </div>
  <v-data-table
    v-else
    :headers="tableHeaders"
    :items="listRows"
    item-value="id"
  >
    <template #[`item.productImageUrl`]="{ value }">
      <v-img
        v-if="value"
        :src="value"
        alt=""
        width="48"
        height="48"
        cover
      />
    </template>
    <template #[`item.productName`]="{ item: listRow }">
      <NuxtLink :to="`/stock/${listRow.id}`">
        {{ listRow.productName }}
      </NuxtLink>
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import type { StockItemRow } from '~~/shared/stock/stock-item-row'

const props = defineProps({
  stockItems: { type: Array as PropType<StockItemRow[]>, required: true },
  locationLabelsById: { type: Object as PropType<Map<string, string>>, required: true },
})

const { isMobile, listRows, tableHeaders } = useStockItemList(
  () => props.stockItems,
  () => props.locationLabelsById,
)
</script>

<style scoped>
.stock-item-list {
  display: grid;
  gap: 12px;
}

.stock-item-list__card {
  display: flex;
  gap: 12px;
  padding: 12px;
}
</style>
