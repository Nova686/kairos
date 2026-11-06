<template>
  <p
    v-if="sales.length === 0"
    class="kairos-empty"
  >
    Aucune vente pour le moment.
  </p>
  <div
    v-else
    class="sale-list"
  >
    <v-card
      v-for="sale in sales"
      :key="sale.id"
      class="kairos-row-card"
    >
      <div>
        <div class="kairos-row-card__title">
          {{ sale.platform }} · {{ sale.soldOn }}
        </div>
        <div class="kairos-row-card__detail">
          {{ describeSoldProducts(sale.items.map(saleItem => saleItem.productName)) }}
        </div>
        <div class="kairos-row-card__detail">
          {{ sale.items.length }} exemplaire(s) · <span class="kairos-figure">{{ formatEuros(sale.totalPriceCents) }}</span>
        </div>
        <div v-if="sale.trackingReference">
          <TrackingReference :tracking-reference="sale.trackingReference" />
        </div>
      </div>
      <div class="text-right">
        <div class="kairos-label">
          Bénéfice net
        </div>
        <SignedAmount
          class="sale-list__profit"
          :cents="sale.netProfitCents"
        />
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

.sale-list__profit {
  font-size: 18px;
}
</style>
