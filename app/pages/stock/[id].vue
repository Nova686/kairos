<template>
  <div v-if="stockItem">
    <h1 class="text-h5 mb-4">
      {{ stockItem.productName }}
    </h1>
    <dl class="stock-item-page__details">
      <dt>Statut</dt>
      <dd>{{ stockItemStatusLabels[stockItem.status] }}</dd>
      <dt>Prix d’achat</dt>
      <dd>{{ formatEuros(stockItem.allocatedPurchaseCents) }}</dd>
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
        <dd>{{ stockItem.certificateNumber ?? '—' }}</dd>
      </template>
      <dt>Reçu le</dt>
      <dd>{{ stockItem.receivedOn ?? '—' }}</dd>
      <dt>Référence de suivi</dt>
      <dd>{{ purchaseTrackingReference ?? '—' }}</dd>
      <dt>Notes</dt>
      <dd>{{ stockItem.notes ?? '—' }}</dd>
    </dl>
    <v-btn
      v-if="isInTransit"
      color="primary"
      class="my-4"
      @click="receiveStockItem"
    >
      Marquer comme reçu
    </v-btn>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="my-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
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
    <h2 class="text-h6 mt-8 mb-2">
      Journal du produit
    </h2>
    <p v-if="changes.length === 0">
      Aucune modification enregistrée.
    </p>
    <v-list v-else>
      <v-list-item
        v-for="change in changes"
        :key="change.id"
        :title="change.fieldName === '*' ? 'Création du produit' : change.fieldName"
        :subtitle="`${change.changedAt.slice(0, 10)} · ${describeChangedValue(change.previousValue)} → ${describeChangedValue(change.newValue)}`"
      />
    </v-list>
  </div>
  <p v-else>
    Exemplaire introuvable.
  </p>
</template>

<script setup lang="ts">
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

const describeChangedValue = (changedValue: unknown): string =>
  changedValue === null || changedValue === undefined ? '—' : String(typeof changedValue === 'object' ? JSON.stringify(changedValue) : changedValue)
</script>

<style scoped>
.stock-item-page__details {
  display: grid;
  gap: 4px 16px;
  grid-template-columns: max-content 1fr;
}

.stock-item-page__details dt {
  font-weight: 500;
}

.stock-item-page__form {
  max-width: 560px;
}
</style>
