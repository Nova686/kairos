<template>
  <div v-if="product">
    <h1 class="text-h5 mb-1">
      Prix · {{ product.name }}
    </h1>
    <p class="mb-4">
      Dernier relevé : {{ lastRefreshedAt ? formatParisDate(lastRefreshedAt) : 'jamais' }}
    </p>
    <div class="product-prices-page__actions">
      <v-btn
        color="primary"
        :loading="isRefreshing"
        @click="refreshNow"
      >
        Relever maintenant
      </v-btn>
      <v-btn @click="isManualPriceOpen = true">
        Ajouter un prix vu
      </v-btn>
    </div>
    <v-alert
      v-if="refreshMessage"
      type="info"
      class="mb-4"
      role="status"
    >
      {{ refreshMessage }}
    </v-alert>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="mb-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>

    <h2 class="text-h6 mb-2">
      Prix par source
    </h2>
    <PriceBySourceTable
      :columns="columns"
      :rows="rows"
      :card-references="cardReferences"
      @open-cell="openListings"
    />

    <h2 class="text-h6 mt-8 mb-2">
      Historique
    </h2>
    <v-select
      v-model="selectedColumnKey"
      label="État affiché"
      :items="columnOptions"
      class="product-prices-page__condition"
      no-data-text="Aucun prix relevé."
    />
    <ClientOnly>
      <PriceHistoryChart :chart-data="chartData" />
      <template #fallback>
        <v-progress-linear indeterminate />
      </template>
    </ClientOnly>

    <h2 class="text-h6 mt-8 mb-2">
      Recherche eBay
    </h2>
    <EbaySearchSettings
      :ebay-query="product.ebayQuery"
      :excluded-keywords="product.ebayExcludedKeywords"
      :save-ebay-settings="saveEbaySettings"
    />

    <RetainedListingsDialog
      :price-cell="openedCell"
      :excluded-listing-urls="excludedListingUrls"
      @close="closeListings"
      @exclude-listing="excludeListing"
    />
    <v-dialog
      v-model="isManualPriceOpen"
      max-width="520"
    >
      <v-card title="Ajouter un prix vu">
        <v-card-text>
          <ManualPriceForm
            :condition-options="conditionOptions"
            :is-graded-card="category === 'graded-card'"
            :save-manual-price="saveManualPrice"
            @cancel="isManualPriceOpen = false"
            @saved="isManualPriceOpen = false"
          />
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
  <p v-else>
    Produit introuvable.
  </p>
</template>

<script setup lang="ts">
const route = useRoute()

const preferredCondition = typeof route.query.condition === 'string' ? route.query.condition : null

const {
  product,
  category,
  columns,
  rows,
  cardReferences,
  lastRefreshedAt,
  conditionOptions,
  columnOptions,
  selectedColumnKey,
  chartData,
  errorMessage,
  refreshMessage,
  isRefreshing,
  openedCell,
  excludedListingUrls,
  refreshNow,
  openListings,
  closeListings,
  excludeListing,
  saveManualPrice,
  saveEbaySettings,
} = await useProductPrices(String(route.params.id), preferredCondition)

const isManualPriceOpen = ref(false)
</script>

<style scoped>
.product-prices-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.product-prices-page__condition {
  max-width: 360px;
}
</style>
