<template>
  <section
    class="stock-value-summary"
    aria-label="Valeur du stock"
  >
    <v-card class="stock-value-summary__card stock-value-summary__card--hero kairos-holo">
      <span class="kairos-label">Valeur actuelle</span>
      <span class="stock-value-summary__figure stock-value-summary__figure--hero kairos-figure">
        {{ formatEuros(stockValue.estimatedValueCents) }}
      </span>
      <span
        v-if="highlights.latentGainRatio !== null"
        class="stock-value-summary__foot"
      >
        <span
          class="stock-value-summary__pill"
          :class="`stock-value-summary__pill--${describeGainRatioTone(highlights.latentGainRatio)}`"
        >
          {{ formatSignedPercent(highlights.latentGainRatio) }}
        </span>
        par rapport au coût d’achat
      </span>
    </v-card>
    <v-card class="stock-value-summary__card">
      <span class="kairos-label">Coût du stock</span>
      <span class="stock-value-summary__figure kairos-figure">
        {{ formatEuros(stockValue.purchaseCostCents) }}
      </span>
      <span class="stock-value-summary__foot">
        {{ pluralizeFrench(highlights.heldItemCount, 'exemplaire') }}
      </span>
    </v-card>
    <v-card class="stock-value-summary__card">
      <span class="kairos-label">Plus-value latente</span>
      <SignedAmount
        class="stock-value-summary__figure"
        :cents="stockValue.latentGainCents"
      />
      <span class="stock-value-summary__foot">
        <span v-if="stockValue.approximateItemCount > 0">
          ≈ {{ pluralizeFrench(stockValue.approximateItemCount, 'estimé') }} d’après un état voisin
        </span>
        <span v-if="stockValue.unvaluedItemCount > 0">
          {{ stockValue.unvaluedItemCount }} sans prix, {{ stockValue.unvaluedItemCount > 1 ? 'non comptés' : 'non compté' }}
        </span>
      </span>
    </v-card>
  </section>
</template>

<script setup lang="ts">
import type { DashboardStockValueView } from '~/composables/useDashboardOverview'

const props = defineProps({
  stockValue: { type: Object as PropType<DashboardStockValueView>, required: true },
})

const highlights = computed(() => describeStockValueHighlights(props.stockValue))
</script>

<style scoped>
.stock-value-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stock-value-summary__card {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px;
  min-width: 0;
}

.stock-value-summary__card--hero {
  grid-column: 1 / -1;
}

.stock-value-summary__figure {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.stock-value-summary__figure--hero {
  font-size: 32px;
  background: linear-gradient(90deg, #f1f5fa, #c9d9ee 60%, #e9d3b0);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.stock-value-summary__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 12.5px;
  color: var(--kairos-text-secondary);
}

.stock-value-summary__pill {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.stock-value-summary__pill--neutral {
  background: color-mix(in srgb, var(--kairos-text-secondary) 15%, transparent);
  color: var(--kairos-text-secondary);
}

.stock-value-summary__pill--gain {
  background: color-mix(in srgb, var(--kairos-success) 15%, transparent);
  color: var(--kairos-success);
}

.stock-value-summary__pill--loss {
  background: color-mix(in srgb, var(--kairos-error) 15%, transparent);
  color: var(--kairos-error);
}

@media (min-width: 960px) {
  .stock-value-summary {
    grid-template-columns: 1.25fr 1fr 1fr;
    gap: 14px;
  }

  .stock-value-summary__card {
    gap: 8px;
    padding: 18px;
  }

  .stock-value-summary__card--hero {
    grid-column: auto;
  }

  .stock-value-summary__figure {
    font-size: 28px;
  }

  .stock-value-summary__figure--hero {
    font-size: 36px;
  }
}
</style>
