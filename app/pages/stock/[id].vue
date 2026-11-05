<template>
  <div
    v-if="stockItem"
    class="stock-item-page"
  >
    <header class="stock-item-page__header">
      <ProductThumbnail
        :category="stockItem.productCategory"
        :image-url="stockItem.productImageUrl"
        :size="88"
      />
      <div class="stock-item-page__identity">
        <div class="stock-item-page__chips">
          <v-chip
            size="small"
            :color="conditionChipColor"
          >
            {{ describeStockItemCondition(stockItem.condition, stockItem.gradingCompany, stockItem.grade) }}
          </v-chip>
          <v-chip
            size="small"
            variant="outlined"
          >
            {{ stockItemStatusLabels[stockItem.status] }}
          </v-chip>
        </div>
        <h1 class="kairos-page-title stock-item-page__title">
          {{ stockItem.productName }}
        </h1>
        <p class="kairos-page-subtitle">
          Prix d’achat <span class="kairos-figure">{{ formatEuros(stockItem.allocatedPurchaseCents) }}</span>
        </p>
      </div>
    </header>
    <div class="stock-item-page__actions">
      <v-btn
        :to="productPricesLink"
        variant="outlined"
      >
        Voir les prix
      </v-btn>
      <v-btn
        v-if="isInTransit"
        color="primary"
        @click="receiveStockItem"
      >
        Marquer comme reçu
      </v-btn>
    </div>
    <v-alert
      v-if="errorMessage"
      type="error"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <v-card class="stock-item-page__card">
      <h2 class="kairos-card-title">
        Détails
      </h2>
      <dl class="stock-item-page__details">
        <dt>Statut</dt>
        <dd>{{ stockItemStatusLabels[stockItem.status] }}</dd>
        <dt>Prix d’achat</dt>
        <dd class="kairos-figure">
          {{ formatEuros(stockItem.allocatedPurchaseCents) }}
        </dd>
        <dt>État</dt>
        <dd>{{ describeStockItemCondition(stockItem.condition, null, null) }}</dd>
        <dt>Lieu</dt>
        <dd>{{ locationLabel }}</dd>
        <template v-if="stockItem.productCategory === 'graded-card'">
          <dt>Société de gradation</dt>
          <dd>{{ stockItem.gradingCompany ?? '—' }}</dd>
          <dt>Note</dt>
          <dd>{{ stockItem.grade ?? '—' }}</dd>
          <dt>Numéro de certificat</dt>
          <dd class="kairos-figure">
            {{ stockItem.certificateNumber ?? '—' }}
          </dd>
        </template>
        <dt>Reçu le</dt>
        <dd>{{ stockItem.receivedOn ?? '—' }}</dd>
        <dt>Référence de suivi</dt>
        <dd>{{ purchaseTrackingReference ?? '—' }}</dd>
        <dt>Notes</dt>
        <dd>{{ stockItem.notes ?? '—' }}</dd>
      </dl>
    </v-card>
    <v-card class="stock-item-page__card">
      <h2 class="kairos-card-title">
        Modifier
      </h2>
      <v-form
        class="stock-item-page__form"
        @submit.prevent="saveChanges"
      >
        <v-select
          v-model="editedCondition"
          label="État"
          :items="conditionOptions"
          :disabled="stockItem.productCategory === 'graded-card'"
        />
        <v-select
          v-model="editedLocationId"
          label="Lieu"
          :items="locationOptions"
          clearable
        />
        <v-textarea
          v-model="editedNotes"
          label="Notes"
        />
        <v-btn
          type="submit"
          color="primary"
        >
          Enregistrer
        </v-btn>
      </v-form>
    </v-card>
    <v-card class="stock-item-page__card">
      <h2 class="kairos-card-title">
        Journal du produit
      </h2>
      <p class="stock-item-page__journal-link">
        <NuxtLink :to="productPricesLink">
          Prix et historique du produit
        </NuxtLink>
      </p>
      <p
        v-if="changes.length === 0"
        class="stock-item-page__muted"
      >
        Aucune modification enregistrée.
      </p>
      <v-list
        v-else
        bg-color="transparent"
      >
        <v-list-item
          v-for="change in changes"
          :key="change.id"
          :title="change.fieldName === '*' ? 'Création du produit' : change.fieldName"
          :subtitle="`${change.changedAt.slice(0, 10)} · ${describeChangedValue(change.previousValue)} → ${describeChangedValue(change.newValue)}`"
        />
      </v-list>
    </v-card>
  </div>
  <p v-else>
    Exemplaire introuvable.
  </p>
</template>

<script setup lang="ts">
import { readBarcodeJournalValue } from '~~/shared/catalogue/barcode-journal-value'
import { stockItemStatusLabels } from '~~/shared/stock/stock-item-status'

const route = useRoute()

const {
  stockItem,
  locations,
  changes,
  purchaseTrackingReference,
  locationLabel,
  editedCondition,
  editedLocationId,
  editedNotes,
  conditionOptions,
  isInTransit,
  errorMessage,
  saveChanges,
  receiveStockItem,
} = await useStockItemDetail(String(route.params.id))

const locationOptions = computed(() => locations.value.map(location => ({ value: location.id, title: location.label })))

const conditionChipColor = computed(() => {
  const chipTone = describeConditionChipTone(stockItem.value?.productCategory ?? '')
  return chipTone === 'neutral' ? undefined : chipTone
})

const productPricesLink = computed(() => {
  const columnKey = stockItem.value ? columnKeyOfStockItem(stockItem.value) : ''
  return `/produits/${stockItem.value?.productId}?condition=${encodeURIComponent(columnKey)}`
})

const describeChangedValue = (changedValue: unknown): string => {
  if (changedValue === null || changedValue === undefined) {
    return '—'
  }
  const journaledBarcode = readBarcodeJournalValue(changedValue)
  if (journaledBarcode !== null) {
    return journaledBarcode
  }
  return typeof changedValue === 'object' ? JSON.stringify(changedValue) : String(changedValue)
}
</script>

<style scoped>
.stock-item-page {
  display: grid;
  gap: 14px;
  align-content: start;
}

.stock-item-page__header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stock-item-page__identity {
  display: grid;
  flex: 1;
  gap: 6px;
  min-width: 0;
}

.stock-item-page__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.stock-item-page__title {
  font-size: 21px;
  overflow-wrap: anywhere;
}

.stock-item-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-item-page__card {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.stock-item-page__details {
  display: grid;
  gap: 6px 16px;
  grid-template-columns: max-content minmax(0, 1fr);
  margin: 0;
}

.stock-item-page__details dt {
  color: var(--kairos-text-secondary);
  font-weight: 500;
}

.stock-item-page__details dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.stock-item-page__form {
  max-width: 560px;
}

.stock-item-page__journal-link,
.stock-item-page__muted {
  margin: 0;
}

.stock-item-page__muted {
  color: var(--kairos-text-secondary);
}

@media (min-width: 960px) {
  .stock-item-page__title {
    font-size: 26px;
  }
}
</style>
