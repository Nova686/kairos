<template>
  <v-card class="purchase-form">
    <h2 class="kairos-card-title purchase-form__title">
      Achat en cours
      <v-chip
        v-if="lines.length > 0"
        size="small"
      >
        {{ pluralizeFrench(lines.length, 'ligne') }}
      </v-chip>
    </h2>
    <p
      v-if="lines.length === 0"
      class="purchase-form__empty"
    >
      Choisissez un produit pour commencer l’achat.
    </p>
    <v-form
      v-else
      :readonly="isLocked"
      @submit.prevent="submitAndLeave"
    >
    <div
      v-for="line in lines"
      :key="line.lineKey"
      class="purchase-form__line"
    >
      <div class="purchase-form__line-header">
        <ProductThumbnail
          :category="line.product.category"
          :size="40"
        />
        <span class="purchase-form__product-name">{{ line.product.name }}</span>
        <v-btn
          icon="mdi-delete"
          variant="text"
          :disabled="isLocked"
          :aria-label="`Retirer ${line.product.name}`"
          @click="removeLine(line.lineKey)"
        />
      </div>
      <div class="purchase-form__grid">
        <v-select
          v-model="line.condition"
          label="État"
          :items="conditionOptionsFor(line)"
          hide-details
        />
        <v-select
          v-model="line.locationId"
          label="Lieu"
          :items="locationOptions"
          clearable
          hide-details
        />
        <template v-if="isGradedLine(line)">
          <v-text-field
            v-model="line.gradingCompany"
            label="Société de gradation"
            hide-details
          />
          <v-text-field
            v-model="line.grade"
            label="Note"
            hide-details
          />
          <v-text-field
            v-model="line.certificateNumber"
            label="Numéro de certificat"
            hide-details
          />
        </template>
      </div>
    </div>

    <div class="purchase-form__grid">
      <v-text-field
        v-model="purchasedOn"
        label="Date d’achat"
        type="date"
        hide-details
      />
      <v-text-field
        v-model="sellerLabel"
        label="Vendeur"
        hide-details
      />
      <MoneyField
        v-model="totalPriceText"
        label="Prix total du lot"
      />
      <MoneyField
        v-model="feesText"
        label="Frais"
      />
    </div>

    <v-switch
      v-model="isInTransit"
      label="En livraison"
      hide-details
    />
    <v-text-field
      v-if="isInTransit"
      v-model="trackingReference"
      label="Référence de suivi"
    />

    <div class="purchase-form__grid">
      <v-select
        v-model="advancedByPersonId"
        label="Avancé par"
        :items="personOptions"
        clearable
        hide-details
      />
      <MoneyField
        v-if="advancedByPersonId"
        v-model="advancedAmountText"
        label="Montant avancé"
      />
    </div>

    <v-alert
      v-if="isLocked"
      type="info"
      class="my-4"
    >
      Achat enregistré — seule la dette reste à créer.
    </v-alert>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="my-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <v-btn
      type="submit"
      color="primary"
      class="mt-4"
      :loading="isSubmitting"
      :disabled="isSubmitting"
    >
      {{ isLocked ? "Réessayer de créer la dette" : "Enregistrer l’achat" }}
    </v-btn>
    </v-form>
  </v-card>
</template>

<script setup lang="ts">
const {
  lines,
  purchasedOn,
  sellerLabel,
  totalPriceText,
  feesText,
  isInTransit,
  trackingReference,
  advancedByPersonId,
  advancedAmountText,
  errorMessage,
  isSubmitting,
  locations,
  persons,
  addLine,
  removeLine,
  removeLatestLineOfProduct,
  conditionOptionsFor,
  isGradedLine,
  submitPurchase,
  isLocked,
} = usePurchaseForm()

const emit = defineEmits<{ purchaseRecorded: [productIds: string[]] }>()

const locationOptions = computed(() => locations.value.map(location => ({ value: location.id, title: location.label })))
const personOptions = computed(() => persons.value.map(person => ({ value: person.id, title: person.name })))

const submitAndLeave = async () => {
  const purchasedProductIds = lines.value.map(line => line.product.id)
  if (await submitPurchase()) {
    emit('purchaseRecorded', purchasedProductIds)
    await navigateTo('/stock')
  }
}

defineExpose({ addLine, removeLatestLineOfProduct })
</script>

<style scoped>
.purchase-form {
  padding: 18px;
}

.purchase-form__title {
  align-items: center;
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.purchase-form__empty {
  color: var(--kairos-text-secondary);
  margin: 0;
}

.purchase-form__line {
  background: var(--kairos-surface-variant);
  border: 1px solid var(--kairos-border);
  border-radius: calc(var(--kairos-radius) - 4px);
  margin-bottom: 12px;
  padding: 12px;
}

.purchase-form__line-header {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.purchase-form__product-name {
  flex: 1;
  font-weight: 600;
  min-width: 0;
}

.purchase-form__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-bottom: 12px;
}
</style>
