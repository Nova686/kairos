<template>
  <p
    v-if="listRows.length === 0"
    class="stock-item-list__empty"
  >
    Aucun exemplaire en stock.
  </p>
  <div
    v-else
    class="stock-item-list__responsive"
  >
    <div class="stock-item-list kairos-phone-only">
      <v-card
        v-for="listRow in listRows"
        :key="listRow.id"
        :to="`/stock/${listRow.id}`"
        class="stock-item-list__card"
      >
        <ProductThumbnail
          :category="listRow.productCategory"
          :image-url="listRow.productImageUrl"
        />
        <div class="stock-item-list__body">
          <div class="stock-item-list__name">
            {{ listRow.productName }}
          </div>
          <div class="stock-item-list__meta">
            <v-chip
              size="small"
              :color="chipColors[listRow.conditionTone]"
            >
              {{ listRow.conditionText }}
            </v-chip>
            <span>{{ listRow.locationText }}</span>
          </div>
          <div class="stock-item-list__money">
            <span class="stock-item-list__purchase kairos-figure">Achat {{ formatEuros(listRow.purchasePriceCents) }}</span>
            <StockItemValue :value-description="listRow.valueDescription" />
          </div>
          <div
            v-if="listRow.gainCents !== null"
            class="stock-item-list__gain"
          >
            <SignedAmount :cents="listRow.gainCents" />
          </div>
        </div>
      </v-card>
    </div>
    <v-card class="stock-item-list__table-card kairos-desktop-only">
      <v-data-table
        class="stock-item-list__table"
        :headers="tableHeaders"
        :items="listRows"
        item-value="id"
      >
        <template #[`item.productName`]="{ item: listRow }">
          <div class="stock-item-list__product">
            <ProductThumbnail
              :category="listRow.productCategory"
              :image-url="listRow.productImageUrl"
            />
            <NuxtLink
              :to="`/stock/${listRow.id}`"
              class="stock-item-list__link"
              :title="listRow.productName"
            >
              {{ listRow.productName }}
            </NuxtLink>
          </div>
        </template>
        <template #[`item.conditionText`]="{ item: listRow }">
          <v-chip
            size="small"
            :color="chipColors[listRow.conditionTone]"
          >
            {{ listRow.conditionText }}
          </v-chip>
        </template>
        <template #[`item.locationText`]="{ value }">
          <span class="stock-item-list__nowrap stock-item-list__muted">{{ value }}</span>
        </template>
        <template #[`item.statusText`]="{ value }">
          <v-chip
            size="small"
            variant="outlined"
          >
            {{ value }}
          </v-chip>
        </template>
        <template #[`item.purchasePriceCents`]="{ value }">
          <span class="kairos-figure stock-item-list__nowrap">{{ formatEuros(value) }}</span>
        </template>
        <template #[`item.valueCents`]="{ item: listRow }">
          <StockItemValue :value-description="listRow.valueDescription" />
        </template>
        <template #[`item.gainCents`]="{ item: listRow }">
          <SignedAmount
            v-if="listRow.gainCents !== null"
            class="stock-item-list__gain-figure"
            :cents="listRow.gainCents"
          />
          <span
            v-else
            class="stock-item-list__muted"
          >—</span>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { StockItemListRow } from '~/composables/useStockItemList'
import type { ConditionChipTone } from '~/utils/stock-list-view'

defineProps({
  listRows: { type: Array as PropType<StockItemListRow[]>, required: true },
  tableHeaders: { type: Array as PropType<Record<string, unknown>[]>, required: true },
})

const chipColors: Record<ConditionChipTone, string | undefined> = {
  primary: 'primary',
  accent: 'accent',
  neutral: undefined,
}
</script>

<style scoped>
.stock-item-list__empty {
  color: var(--kairos-text-secondary);
}

.stock-item-list {
  display: grid;
  gap: 10px;
}

.stock-item-list__card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
}

.stock-item-list__body {
  display: grid;
  flex: 1;
  gap: 4px;
  min-width: 0;
}

.stock-item-list__name {
  display: -webkit-box;
  overflow: hidden;
  font-weight: 600;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.stock-item-list__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--kairos-text-secondary);
}

.stock-item-list__money {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  font-weight: 600;
}

.stock-item-list__purchase {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--kairos-text-secondary);
  white-space: nowrap;
}

.stock-item-list__gain {
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
}

.stock-item-list__table-card {
  padding: 4px 6px;
}

.stock-item-list__table {
  background: transparent;
}

.stock-item-list__table :deep(th),
.stock-item-list__table :deep(td) {
  padding: 0 10px;
}

.stock-item-list__table :deep(th) {
  white-space: nowrap;
}

.stock-item-list__table :deep(.v-chip),
.stock-item-list__table :deep(.stock-item-value),
.stock-item-list__table :deep(.signed-amount) {
  white-space: nowrap;
}

@media (max-width: 1279.98px) {
  .stock-item-list__table :deep(.stock-item-list__location-column) {
    display: none;
  }
}

.stock-item-list__product {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.stock-item-list__link {
  display: -webkit-box;
  overflow: hidden;
  font-weight: 600;
  line-height: 1.3;
  color: inherit;
  text-decoration: none;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.stock-item-list__link:hover {
  color: var(--kairos-primary);
}

.stock-item-list__nowrap {
  white-space: nowrap;
}

.stock-item-list__muted {
  color: var(--kairos-text-secondary);
}

.stock-item-list__gain-figure {
  font-weight: 600;
}
</style>
