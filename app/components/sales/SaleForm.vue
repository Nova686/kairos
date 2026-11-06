<template>
  <v-form
    :readonly="isLocked"
    @submit.prevent="submitAndLeave"
  >
    <v-select
      v-model="selectedStockItemIds"
      label="Exemplaires vendus"
      :items="stockItemOptions"
      multiple
      chips
      closable-chips
      no-data-text="Aucun exemplaire en stock."
    />

    <div class="sale-form__grid">
      <v-text-field
        v-model="soldOn"
        label="Date de vente"
        type="date"
        hide-details
      />
      <v-combobox
        v-model="platform"
        label="Plateforme"
        :items="platformSuggestions"
        hide-details
      />
      <MoneyField
        v-model="totalPriceText"
        label="Prix total"
      />
      <v-select
        v-model="buyerPersonId"
        label="Acheteur"
        :items="personOptions"
        clearable
        hide-details
      />
    </div>
    <p class="mb-4">
      <NuxtLink to="/personnes">
        Gérer les personnes
      </NuxtLink>
    </p>

    <v-switch
      v-model="isShippingIncluded"
      label="Port inclus"
      hide-details
    />
    <div class="sale-form__grid">
      <MoneyField
        v-model="shippingCostText"
        label="Frais de port"
      />
      <MoneyField
        v-model="platformFeesText"
        label="Frais de plateforme"
      />
      <MoneyField
        v-model="packagingCostText"
        label="Emballage"
      />
      <v-text-field
        v-model="trackingReference"
        label="Référence de suivi"
        hide-details
      />
    </div>

    <v-switch
      v-model="isNotYetPaid"
      label="Pas encore payé"
      hide-details
    />

    <v-card
      class="sale-form__preview"
      variant="tonal"
    >
      <div>Net de la vente : {{ formatEuros(saleNetCents) }}</div>
      <div>Coût d’achat : {{ formatEuros(purchaseCostCents) }}</div>
      <div class="text-subtitle-1">
        Bénéfice net : {{ formatEuros(netProfitCents) }}
      </div>
    </v-card>

    <v-alert
      v-if="isLocked"
      type="info"
      class="my-4"
    >
      Vente enregistrée — seule la dette reste à créer.
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
      {{ isLocked ? "Réessayer de créer la dette" : "Enregistrer la vente" }}
    </v-btn>
  </v-form>
</template>

<script setup lang="ts">
const {
  soldOn,
  platform,
  buyerPersonId,
  totalPriceText,
  isShippingIncluded,
  shippingCostText,
  platformFeesText,
  packagingCostText,
  trackingReference,
  selectedStockItemIds,
  isNotYetPaid,
  errorMessage,
  isSubmitting,
  stockItemOptions,
  personOptions,
  saleNetCents,
  purchaseCostCents,
  netProfitCents,
  submitSale,
  isLocked,
} = useSaleForm()

const submitAndLeave = async () => {
  if (await submitSale()) {
    await navigateTo('/ventes')
  }
}
</script>

<style scoped>
.sale-form__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-bottom: 12px;
}

.sale-form__preview {
  margin-top: 12px;
  padding: 12px;
}
</style>
