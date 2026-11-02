<template>
  <v-form
    class="manual-price-form"
    @submit.prevent="submitAndClose"
  >
    <v-select
      v-model="source"
      label="Source"
      :items="manualPriceSourceOptions"
      hide-details
    />
    <v-select
      v-model="condition"
      label="État"
      :items="conditionOptions"
      :disabled="conditionOptions.length === 1"
      hide-details
    />
    <template v-if="isGradedCard">
      <v-text-field
        v-model="gradingCompany"
        label="Société de gradation"
        hide-details
      />
      <v-text-field
        v-model="grade"
        label="Note"
        inputmode="decimal"
        hide-details
      />
    </template>
    <MoneyField
      v-model="priceText"
      label="Prix vu"
    />
    <v-text-field
      v-model="observedOn"
      label="Date"
      type="date"
      :max="maximumObservedOn"
      hide-details
    />
    <v-text-field
      v-model="url"
      label="Lien (facultatif)"
      type="url"
      hide-details
    />
    <v-alert
      v-if="errorMessage"
      type="error"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <div class="d-flex ga-2">
      <v-btn
        type="submit"
        color="primary"
      >
        Enregistrer
      </v-btn>
      <v-btn @click="emit('cancel')">
        Annuler
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import type { ManualPriceFormOption } from '~/composables/useManualPriceForm'

const props = defineProps({
  conditionOptions: { type: Array as PropType<ManualPriceFormOption[]>, required: true },
  isGradedCard: { type: Boolean, required: true },
  saveManualPrice: { type: Function as PropType<(body: Record<string, unknown>) => Promise<boolean>>, required: true },
})

const emit = defineEmits<{ cancel: [], saved: [] }>()

const {
  source,
  condition,
  gradingCompany,
  grade,
  priceText,
  observedOn,
  url,
  errorMessage,
  maximumObservedOn,
  submitManualPrice,
} = useManualPriceForm(
  () => props.conditionOptions,
  () => props.isGradedCard,
  body => props.saveManualPrice(body),
)

const submitAndClose = async () => {
  if (await submitManualPrice()) {
    emit('saved')
  }
}
</script>

<style scoped>
.manual-price-form {
  display: grid;
  gap: 12px;
}
</style>
