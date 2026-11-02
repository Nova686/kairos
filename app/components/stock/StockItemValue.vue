<template>
  <span
    v-if="!valueDescription.hasPrice"
    class="text-medium-emphasis"
  >
    pas de prix
  </span>
  <span v-else>
    <span>
      {{ valueDescription.isApproximate ? '≈ ' : '' }}{{ formatEuros(valueDescription.valueCents ?? 0) }}
      <v-tooltip
        v-if="valueDescription.approximateTooltip"
        activator="parent"
        location="top"
      >
        {{ valueDescription.approximateTooltip }}
      </v-tooltip>
    </span>
    <span
      v-if="showGain && valueDescription.gainCents !== null"
      :class="valueDescription.gainCents < 0 ? 'text-error' : 'text-success'"
    >
      ({{ valueDescription.gainCents > 0 ? '+' : '' }}{{ formatEuros(valueDescription.gainCents) }})
    </span>
  </span>
</template>

<script setup lang="ts">
import type { StockItemValueDescription } from '~/utils/stock-value-view'

defineProps({
  valueDescription: { type: Object as PropType<StockItemValueDescription>, required: true },
  showGain: { type: Boolean, default: false },
})
</script>
