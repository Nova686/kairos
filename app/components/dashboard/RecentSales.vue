<template>
  <v-card class="recent-sales">
    <h2 class="kairos-card-title">
      Dernières ventes
    </h2>
    <p
      v-if="recentSales.length === 0"
      class="recent-sales__empty"
    >
      Aucune vente.
    </p>
    <ul
      v-else
      class="recent-sales__list"
    >
      <li
        v-for="recentSale in recentSales"
        :key="recentSale.id"
      >
        <NuxtLink
          to="/ventes"
          class="recent-sales__row"
        >
          <span class="recent-sales__main">
            <span class="recent-sales__platform">{{ recentSale.platform }}</span>
            <span class="recent-sales__date">{{ formatDayNumber(dayNumberOf(recentSale.soldOn)) }}</span>
          </span>
          <SignedAmount
            class="recent-sales__profit"
            :cents="recentSale.netProfitCents"
          />
        </NuxtLink>
      </li>
    </ul>
  </v-card>
</template>

<script setup lang="ts">
import type { DashboardRecentSaleView } from '~/composables/useDashboardOverview'

defineProps({
  recentSales: { type: Array as PropType<DashboardRecentSaleView[]>, required: true },
})
</script>

<style scoped>
.recent-sales {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 14px;
  min-width: 0;
}

.recent-sales__empty {
  margin: 0;
  color: var(--kairos-text-secondary);
}

.recent-sales__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recent-sales__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--kairos-border);
  color: inherit;
  text-decoration: none;
}

.recent-sales__list li:first-child .recent-sales__row {
  border-top: 0;
}

.recent-sales__main {
  display: grid;
  flex: 1;
  min-width: 0;
}

.recent-sales__platform {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-sales__date {
  font-size: 12.5px;
  color: var(--kairos-text-secondary);
}

.recent-sales__profit {
  flex: none;
  font-weight: 600;
}

@media (min-width: 960px) {
  .recent-sales {
    padding: 18px;
  }
}
</style>
