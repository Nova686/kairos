<template>
  <section aria-labelledby="recent-activity-title">
    <h2
      id="recent-activity-title"
      class="text-h6 mb-2"
    >
      Activité récente
    </h2>
    <div class="recent-activity__tiles">
      <v-card
        to="/livraisons"
        class="pa-4"
      >
        <div class="text-body-2">
          Livraisons en cours
        </div>
        <div>{{ overview.deliveriesInProgress.incoming }} à recevoir · {{ overview.deliveriesInProgress.outgoing }} à expédier</div>
      </v-card>
      <v-card
        to="/dettes"
        class="pa-4"
      >
        <div class="text-body-2">
          Dettes ouvertes
        </div>
        <div>On me doit {{ formatEuros(overview.debtTotals.owedToMeCents) }} · Je dois {{ formatEuros(overview.debtTotals.iOweCents) }}</div>
      </v-card>
    </div>
    <h3 class="text-subtitle-1 mt-4 mb-1">
      Dernières ventes
    </h3>
    <p v-if="overview.recentSales.length === 0">
      Aucune vente.
    </p>
    <v-list
      v-else
      density="compact"
    >
      <v-list-item
        v-for="recentSale in overview.recentSales"
        :key="recentSale.id"
        to="/ventes"
        :title="`${recentSale.platform} · ${recentSale.soldOn}`"
      >
        <template #append>
          <span :class="recentSale.netProfitCents < 0 ? 'text-error' : 'text-success'">
            {{ recentSale.netProfitCents > 0 ? '+' : '' }}{{ formatEuros(recentSale.netProfitCents) }}
          </span>
        </template>
      </v-list-item>
    </v-list>
  </section>
</template>

<script setup lang="ts">
import type { DashboardOverviewView } from '~/composables/useDashboardOverview'

defineProps({
  overview: { type: Object as PropType<DashboardOverviewView>, required: true },
})
</script>

<style scoped>
.recent-activity__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
</style>
