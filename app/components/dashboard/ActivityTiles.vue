<template>
  <div class="activity-tiles">
    <v-card
      to="/livraisons"
      class="activity-tiles__tile"
    >
      <span class="activity-tiles__icon">
        <v-icon
          icon="mdi-truck-outline"
          size="20"
        />
      </span>
      <span class="kairos-label">Livraisons en cours</span>
      <span class="activity-tiles__big kairos-figure">
        {{ deliveriesInProgress.incoming }} · {{ deliveriesInProgress.outgoing }}
      </span>
      <span class="activity-tiles__note">à recevoir · à expédier</span>
    </v-card>
    <v-card
      to="/dettes"
      class="activity-tiles__tile"
    >
      <span class="activity-tiles__icon">
        <v-icon
          icon="mdi-wallet-outline"
          size="20"
        />
      </span>
      <span class="kairos-label">Dettes ouvertes</span>
      <SignedAmount
        class="activity-tiles__big"
        :cents="debtTotals.owedToMeCents - debtTotals.iOweCents"
      />
      <span class="activity-tiles__note">
        On me doit {{ formatEuros(debtTotals.owedToMeCents) }} · Je dois {{ formatEuros(debtTotals.iOweCents) }}
      </span>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import type { DashboardOverviewView } from '~/composables/useDashboardOverview'

defineProps({
  deliveriesInProgress: { type: Object as PropType<DashboardOverviewView['deliveriesInProgress']>, required: true },
  debtTotals: { type: Object as PropType<DashboardOverviewView['debtTotals']>, required: true },
})
</script>

<style scoped>
.activity-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.activity-tiles__tile {
  display: grid;
  align-content: start;
  gap: 4px;
  padding: 14px;
  min-width: 0;
}

.activity-tiles__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-bottom: 4px;
  border-radius: 10px;
  background: var(--kairos-surface-variant);
  color: var(--kairos-primary);
}

.activity-tiles__big {
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap;
}

.activity-tiles__note {
  font-size: 12.5px;
  color: var(--kairos-text-secondary);
}

@media (min-width: 960px) {
  .activity-tiles {
    gap: 14px;
  }

  .activity-tiles__tile {
    padding: 18px;
  }
}
</style>
