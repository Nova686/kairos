<template>
  <p v-if="sales.length === 0">
    Aucune vente pour le moment.
  </p>
  <div
    v-else
    class="sale-list"
  >
    <v-card
      v-for="sale in sales"
      :key="sale.id"
      class="sale-list__card"
    >
      <div>
        <div class="text-subtitle-1">
          {{ sale.platform }} · {{ sale.soldOn }}
        </div>
        <div>{{ sale.items.length }} exemplaire(s) · {{ formatEuros(sale.totalPriceCents) }}</div>
        <div v-if="sale.trackingReference">
          <TrackingReference :tracking-reference="sale.trackingReference" />
        </div>
      </div>
      <div class="text-right">
        <div class="text-caption">
          Bénéfice net
        </div>
        <div
          class="text-h6"
          :class="sale.netProfitCents < 0 ? 'text-error' : 'text-success'"
        >
          {{ formatEuros(sale.netProfitCents) }}
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { SaleListRow } from '~/composables/useSales'

defineProps({
  sales: { type: Array as PropType<SaleListRow[]>, required: true },
})
</script>

<style scoped>
.sale-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.sale-list__card {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 12px;
}
</style>
