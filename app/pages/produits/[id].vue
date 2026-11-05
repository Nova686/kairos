<template>
  <div
    v-if="product"
    class="product-page"
  >
    <header class="product-page__header">
      <ProductThumbnail
        class="kairos-phone-only"
        :category="product.category"
        :image-url="product.imageUrl"
        :size="64"
      />
      <ProductThumbnail
        class="kairos-desktop-only"
        :category="product.category"
        :image-url="product.imageUrl"
        :size="132"
      />
      <div class="product-page__identity">
        <div class="product-page__chips">
          <v-chip
            size="small"
            :color="categoryChipColor"
          >
            {{ productCategoryLabels[category] }}
          </v-chip>
          <v-chip
            v-if="holdings.heldCount > 0"
            size="small"
          >
            {{ pluralizeFrench(holdings.heldCount, 'exemplaire') }} en stock
          </v-chip>
        </div>
        <h1 class="kairos-page-title product-page__title">
          {{ product.name }}
        </h1>
        <p class="kairos-page-subtitle">
          Dernier relevé : {{ lastRefreshedAt ? formatParisDateTime(lastRefreshedAt) : 'jamais' }}
        </p>
      </div>
      <div class="product-page__actions">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-note-edit-outline"
          @click="isManualPriceOpen = true"
        >
          Ajouter un prix vu
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-refresh"
          :loading="isRefreshing"
          @click="refreshNow"
        >
          Relever maintenant
        </v-btn>
      </div>
    </header>

    <v-alert
      v-if="refreshMessage"
      type="info"
      role="status"
    >
      {{ refreshMessage }}
    </v-alert>
    <v-alert
      v-if="errorMessage"
      type="error"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>

    <section
      class="product-page__kpis"
      aria-label="Valeur et plus-value"
    >
      <v-card class="product-page__kpi product-page__kpi--hero kairos-holo">
        <span class="kairos-label">Valeur retenue{{ selectedColumn ? ` · ${selectedColumn.label}` : '' }}</span>
        <StockItemValue
          class="product-page__figure product-page__figure--hero"
          :value-description="retainedValueDescription"
        />
        <span class="product-page__kpi-foot">
          {{ retainedValueDescription.hasPrice ? 'valeur retenue, comme dans le stock' : 'Aucun prix récent pour cet état' }}
        </span>
      </v-card>
      <v-card class="product-page__kpi">
        <span class="kairos-label">Mon prix d’achat moyen</span>
        <span
          v-if="holdings.averagePurchaseCents !== null"
          class="product-page__figure kairos-figure"
        >{{ formatEuros(holdings.averagePurchaseCents) }}</span>
        <span
          v-else
          class="product-page__figure product-page__figure--empty kairos-figure"
        >—</span>
        <span class="product-page__kpi-foot">
          {{ holdings.heldInColumnCount > 0 ? pluralizeFrench(holdings.heldInColumnCount, 'exemplaire') : 'Aucun exemplaire en stock dans cet état' }}
        </span>
      </v-card>
      <v-card class="product-page__kpi">
        <span class="kairos-label">Plus-value</span>
        <SignedAmount
          v-if="gainPerItemCents !== null"
          class="product-page__figure"
          :cents="gainPerItemCents"
        />
        <span
          v-else
          class="product-page__figure product-page__figure--empty kairos-figure"
        >—</span>
        <span class="product-page__kpi-foot">par exemplaire (coût moyen)</span>
      </v-card>
    </section>

    <v-card class="product-page__card">
      <div class="product-page__card-heading">
        <h2 class="kairos-card-title">
          Prix par source
        </h2>
        <span class="product-page__hint">Touchez un prix pour voir les annonces retenues</span>
      </div>
      <v-chip
        v-if="isRefreshPending"
        prepend-icon="mdi-clock-outline"
        role="status"
      >
        Relevé en attente
      </v-chip>
      <p
        v-if="columnOptions.length === 0"
        class="product-page__hint"
      >
        Aucun prix relevé.
      </p>
      <v-chip-group
        v-else
        v-model="selectedColumnKey"
        class="kairos-hidden-scrollbar"
        aria-label="État affiché"
        mandatory
        selected-class="kairos-filter-chip--selected"
      >
        <v-chip
          v-for="columnOption in columnOptions"
          :key="columnOption.value"
          class="kairos-filter-chip"
          :value="columnOption.value"
          variant="outlined"
        >
          {{ columnOption.title }}
        </v-chip>
      </v-chip-group>
      <PriceBySourceTable
        :columns="columns"
        :rows="rows"
        :card-references="cardReferences"
        :selected-column-index="selectedColumnIndex"
        :highlighted-snapshot-id="highlightedSnapshotId"
        @open-cell="openListings"
      />
    </v-card>

    <v-card class="product-page__card">
      <h2 class="kairos-card-title">
        Historique{{ selectedColumn ? ` · ${selectedColumn.label}` : '' }}
      </h2>
      <ClientOnly>
        <PriceHistoryChart :chart-data="chartData" />
        <template #fallback>
          <v-progress-linear indeterminate />
        </template>
      </ClientOnly>
    </v-card>

    <v-card class="product-page__card">
      <h2 class="kairos-card-title">
        Recherche eBay
      </h2>
      <EbaySearchSettings
        :ebay-query="product.ebayQuery"
        :excluded-keywords="product.ebayExcludedKeywords"
        :save-ebay-settings="saveEbaySettings"
      />
    </v-card>

    <RetainedListingsDialog
      :price-cell="openedCell"
      @close="closeListings"
      @exclude-listing="excludeListing"
      @restore-listing="restoreListing"
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
import { productCategoryLabels } from '~~/shared/catalogue/product-category'

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
  selectedColumn,
  selectedColumnIndex,
  retainedValueDescription,
  highlightedSnapshotId,
  chartData,
  errorMessage,
  refreshMessage,
  isRefreshing,
  isRefreshPending,
  openedCell,
  refreshNow,
  openListings,
  closeListings,
  excludeListing,
  restoreListing,
  saveManualPrice,
  saveEbaySettings,
} = await useProductPrices(String(route.params.id), preferredCondition)

const { holdings, gainPerItemCents } = useProductHoldings(
  String(route.params.id),
  () => selectedColumnKey.value,
  () => retainedValueDescription.value.valueCents,
)

const isManualPriceOpen = ref(false)

const categoryChipColor = computed(() => {
  const chipTone = describeConditionChipTone(category.value)
  return chipTone === 'neutral' ? undefined : chipTone
})
</script>

<style scoped>
.product-page {
  display: grid;
  gap: 14px;
  align-content: start;
}

.product-page__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 14px;
}

.product-page__identity {
  display: grid;
  flex: 1;
  gap: 6px;
  min-width: 0;
}

.product-page__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.product-page__title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 21px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.product-page__actions {
  display: flex;
  flex: 1 1 100%;
  gap: 8px;
}

.product-page__actions > .v-btn {
  flex: 1;
}

.product-page__kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.product-page__kpi {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px;
  min-width: 0;
}

.product-page__kpi--hero {
  grid-column: 1 / -1;
}

.product-page__figure {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.product-page__figure--hero {
  font-size: 32px;
}

.product-page__figure--empty {
  color: var(--kairos-text-secondary);
}

.product-page__kpi-foot,
.product-page__hint {
  font-size: 12.5px;
  color: var(--kairos-text-secondary);
}

.product-page__card {
  display: grid;
  gap: 12px;
  padding: 14px;
  min-width: 0;
}

.product-page__card-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

@media (min-width: 960px) {
  .product-page {
    gap: 22px;
  }

  .product-page__header {
    align-items: center;
    gap: 22px;
  }

  .product-page__title {
    font-size: 26px;
  }

  .product-page__actions {
    flex: none;
  }

  .product-page__actions > .v-btn {
    flex: none;
  }

  .product-page__kpis {
    grid-template-columns: 1.25fr 1fr 1fr;
    gap: 14px;
  }

  .product-page__kpi {
    gap: 8px;
    padding: 18px;
  }

  .product-page__kpi--hero {
    grid-column: auto;
  }

  .product-page__figure {
    font-size: 28px;
  }

  .product-page__figure--hero {
    font-size: 36px;
  }

  .product-page__card {
    padding: 18px;
  }
}
</style>
