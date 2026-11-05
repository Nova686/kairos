<template>
  <span
    v-if="valueDescription.state === 'not-applicable'"
    class="stock-item-value stock-item-value--muted"
  >
    —
  </span>
  <span
    v-else-if="!valueDescription.hasPrice"
    class="stock-item-value stock-item-value--muted"
  >
    pas de prix
  </span>
  <span
    v-else
    class="stock-item-value kairos-figure"
    :class="{ 'kairos-approx': valueDescription.isApproximate }"
  >
    {{ valueDescription.isApproximate ? '≈ ' : '' }}{{ formatEuros(valueDescription.valueCents ?? 0) }}<v-tooltip
      v-if="valueDescription.approximateTooltip"
      activator="parent"
      location="top"
    >
      {{ valueDescription.approximateTooltip }}
    </v-tooltip>
  </span>
</template>

<script setup lang="ts">
import type { StockItemValueDescription } from '~/utils/stock-value-view'

defineProps({
  valueDescription: { type: Object as PropType<StockItemValueDescription>, required: true },
})
</script>

<style scoped>
.stock-item-value {
  white-space: nowrap;
}

.stock-item-value--muted {
  color: var(--kairos-text-secondary);
}
</style>
