<template>
  <div class="kairos-page">
    <h1 class="kairos-page-title">
      Dettes
    </h1>
    <DebtBalances :balances="balances" />

    <v-card class="kairos-panel">
      <h2 class="kairos-panel__title">
        Nouvelle dette
      </h2>
      <DebtForm
        :persons="persons"
        :create-debt="createDebt"
      />
    </v-card>

    <h2 class="kairos-label">
      Dettes ouvertes
    </h2>
    <v-alert
      v-if="errorMessage"
      type="error"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <p
      v-if="openDebts.length === 0"
      class="kairos-empty"
    >
      Aucune dette ouverte.
    </p>
    <v-card
      v-for="openDebt in openDebts"
      :key="openDebt.id"
      class="kairos-row-card"
    >
      <div>
        <div class="kairos-row-card__title">
          {{ openDebt.personName }} · {{ debtDirectionLabels[openDebt.direction] }}
          <span class="kairos-figure">{{ formatEuros(openDebt.amountCents) }}</span>
        </div>
        <div class="kairos-row-card__detail">
          {{ openDebt.reason }} · {{ openDebt.createdOn }}
        </div>
      </div>
      <v-btn
        color="primary"
        @click="settleDebt(openDebt.id)"
      >
        Réglé
      </v-btn>
    </v-card>

    <v-expansion-panels>
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

