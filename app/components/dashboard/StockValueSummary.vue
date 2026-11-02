<template>
  <section aria-labelledby="stock-value-summary-title">
    <h2
      id="stock-value-summary-title"
      class="text-h6 mb-2"
    >
      Valeur du stock
    </h2>
    <div class="stock-value-summary__figures">
      <v-card class="pa-4">
        <div class="text-body-2">
          Coût du stock
        </div>
        <div class="text-h5">
          {{ formatEuros(stockValue.purchaseCostCents) }}
        </div>
      </v-card>
      <v-card class="pa-4">
        <div class="text-body-2">
          Valeur actuelle
        </div>
        <div class="text-h5">
          {{ formatEuros(stockValue.estimatedValueCents) }}
        </div>
      </v-card>
    </div>
    <p
      class="mt-2"
      :class="describeGainTone(stockValue.latentGainCents)"
    >
      Gain latent : {{ stockValue.latentGainCents > 0 ? '+' : '' }}{{ formatEuros(stockValue.latentGainCents) }}
    </p>
    <p
      v-if="stockValue.approximateItemCount > 0"
      class="text-medium-emphasis"
    >
      {{ stockValue.approximateItemCount }} exemplaire(s) estimé(s) à partir d’un état voisin
    </p>
    <p
      v-if="stockValue.unvaluedItemCount > 0"
      class="text-medium-emphasis"
    >
      {{ stockValue.unvaluedItemCount }} exemplaire(s) sans prix, non comptés dans la valeur
    </p>
  </section>
</template>

<script setup lang="ts">
import { describeGainTone } from '~/utils/stock-value-view'
import type { DashboardStockValueView } from '~/composables/useDashboardOverview'

defineProps({
  stockValue: { type: Object as PropType<DashboardStockValueView>, required: true },
})
</script>

<style scoped>
.stock-value-summary__figures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
