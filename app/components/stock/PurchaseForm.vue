<template>
  <v-form
    v-if="lines.length > 0"
    @submit.prevent="submitAndLeave"
  >
    <v-card
      v-for="line in lines"
      :key="line.lineKey"
      class="purchase-form__line"
    >
      <div class="purchase-form__line-header">
        <span class="text-subtitle-1">{{ line.product.name }}</span>
        <v-btn
          icon="mdi-delete"
          variant="text"
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
    </v-card>

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
    >
      Enregistrer l’achat
    </v-btn>
  </v-form>
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
  conditionOptionsFor,
  isGradedLine,
  submitPurchase,
} = usePurchaseForm()

const locationOptions = computed(() => locations.value.map(location => ({ value: location.id, title: location.label })))
const personOptions = computed(() => persons.value.map(person => ({ value: person.id, title: person.name })))

const submitAndLeave = async () => {
  if (await submitPurchase()) {
    await navigateTo('/stock')
  }
}

defineExpose({ addLine })
</script>

<style scoped>
.purchase-form__line {
  margin-bottom: 12px;
  padding: 12px;
}

.purchase-form__line-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.purchase-form__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-bottom: 12px;
}
</style>
