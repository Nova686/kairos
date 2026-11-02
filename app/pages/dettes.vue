<template>
  <div>
    <h1 class="text-h5 mb-4">
      Dettes
    </h1>
    <DebtBalances :balances="balances" />

    <h2 class="text-h6 mt-6 mb-2">
      Nouvelle dette
    </h2>
    <DebtForm
      :persons="persons"
      :create-debt="createDebt"
    />

    <h2 class="text-h6 mb-2">
      Dettes ouvertes
    </h2>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="mb-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <p v-if="openDebts.length === 0">
      Aucune dette ouverte.
    </p>
    <v-card
      v-for="openDebt in openDebts"
      :key="openDebt.id"
      class="debts-page__card"
    >
      <div>
        <div class="text-subtitle-1">
          {{ openDebt.personName }} · {{ debtDirectionLabels[openDebt.direction] }} {{ formatEuros(openDebt.amountCents) }}
        </div>
        <div>{{ openDebt.reason }} · {{ openDebt.createdOn }}</div>
      </div>
      <v-btn
        color="primary"
        @click="settleDebt(openDebt.id)"
      >
        Réglé
      </v-btn>
    </v-card>

    <v-expansion-panels class="mt-6">
      <v-expansion-panel title="Historique des dettes réglées">
        <v-expansion-panel-text>
          <p v-if="settledDebts.length === 0">
            Aucune dette réglée.
          </p>
          <div
            v-for="settledDebt in settledDebts"
            :key="settledDebt.id"
            class="mb-2"
          >
            {{ settledDebt.personName }} · {{ debtDirectionLabels[settledDebt.direction] }} {{ formatEuros(settledDebt.amountCents) }}
            · {{ settledDebt.reason }} · réglée le {{ settledDebt.settledOn }}
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup lang="ts">
const { balances, openDebts, settledDebts, persons, errorMessage, settleDebt, createDebt } = useDebts()
</script>

<style scoped>
.debts-page__card {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 12px;
}
</style>
