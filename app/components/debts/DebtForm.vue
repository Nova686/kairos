<template>
  <v-form
    class="debt-form"
    @submit.prevent="submitDebt"
  >
    <v-select
      v-model="personId"
      label="Personne"
      :items="personOptions"
      hide-details
    />
    <v-select
      v-model="direction"
      label="Sens"
      :items="directionOptions"
      hide-details
    />
    <MoneyField
      v-model="amountText"
      label="Montant"
    />
    <v-text-field
      v-model="reason"
      label="Motif"
      hide-details
    />
    <v-text-field
      v-model="createdOn"
      label="Date"
      type="date"
      hide-details
    />
    <v-alert
      v-if="errorMessage"
      type="error"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <div class="d-flex align-center ga-4">
      <v-btn
        type="submit"
        color="primary"
      >
        Ajouter la dette
      </v-btn>
      <NuxtLink to="/personnes">
        Créer une personne
      </NuxtLink>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import type { PersonRow } from '~~/shared/stock/stock-item-row'

const props = defineProps({
  persons: { type: Array as PropType<PersonRow[]>, required: true },
  createDebt: { type: Function as PropType<(body: Record<string, unknown>) => Promise<boolean>>, required: true },
})

const { personId, direction, amountText, reason, createdOn, errorMessage, personOptions, directionOptions, submitDebt } = useDebtForm(
  () => props.persons,
  body => props.createDebt(body),
)
</script>

<style scoped>
.debt-form {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}
</style>
