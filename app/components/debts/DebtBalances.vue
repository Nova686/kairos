<template>
  <v-card class="kairos-panel">
    <h2 class="kairos-panel__title">
      Soldes par personne
    </h2>
    <p
      v-if="balances.length === 0"
      class="kairos-empty"
    >
      Aucune dette ouverte.
    </p>
    <v-list
      v-else
      bg-color="transparent"
      class="pa-0"
    >
      <v-list-item
        v-for="balance in balances"
        :key="balance.personId"
        :title="balance.personName"
      >
        <template #append>
          <span
            v-if="balance.balanceCents === 0"
            class="kairos-row-card__detail"
          >
            soldé
          </span>
          <span
            v-else
            class="kairos-figure"
            :class="balance.balanceCents < 0 ? 'kairos-loss' : 'kairos-gain'"
          >
            {{ balance.balanceCents < 0 ? 'Je dois' : 'On me doit' }} {{ formatEuros(Math.abs(balance.balanceCents)) }}
          </span>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script setup lang="ts">
import type { DebtBalanceRow } from '~/composables/useDebts'

defineProps({
  balances: { type: Array as PropType<DebtBalanceRow[]>, required: true },
})
</script>
