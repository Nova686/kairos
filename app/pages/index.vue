<template>
  <div class="dashboard-page">
    <div class="dashboard-page__heading">
      <h1 class="kairos-page-title">
        Tableau de bord
      </h1>
      <v-btn
        to="/ajouter"
        color="primary"
        prepend-icon="mdi-plus"
        class="d-none d-md-inline-flex"
      >
        Ajouter un achat
      </v-btn>
    </div>
    <v-progress-linear
      v-if="pending && !overview"
      indeterminate
    />
    <v-alert
      v-else-if="hasFailed || !overview"
      type="error"
      role="alert"
    >
      Impossible de charger le tableau de bord.
    </v-alert>
    <template v-else>
      <StockValueSummary :stock-value="overview.stockValue" />
      <div class="dashboard-page__grid">
        <StockValueChart
          class="dashboard-page__chart"
          :chart-data="chartData"
          :last-snapshot-on="lastSnapshotOn"
        />
        <RecentSales
          class="dashboard-page__sales"
          :recent-sales="overview.recentSales"
        />
        <ActivityTiles
          class="dashboard-page__tiles"
          :deliveries-in-progress="overview.deliveriesInProgress"
          :debt-totals="overview.debtTotals"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const { overview, chartData, lastSnapshotOn, pending, hasFailed } = useDashboardOverview()
</script>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 14px;
  align-content: start;
}

.dashboard-page__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-page__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "chart"
    "tiles"
    "sales";
  gap: 14px;
}

.dashboard-page__chart {
  grid-area: chart;
}

.dashboard-page__sales {
  grid-area: sales;
}

.dashboard-page__tiles {
  grid-area: tiles;
}

@media (min-width: 960px) {
  .dashboard-page {
    gap: 22px;
  }

  .dashboard-page__grid {
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    grid-template-areas:
      "chart sales"
      "tiles tiles";
    align-items: start;
    gap: 14px;
  }
}
</style>
