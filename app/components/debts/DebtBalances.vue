<template>
  <div>
    <h2 class="text-h6 mb-2">
      Soldes par personne
    </h2>
    <p v-if="balances.length === 0">
      Aucune dette ouverte.
    </p>
    <v-list v-else>
      <v-list-item
        v-for="balance in balances"
        :key="balance.personId"
        :title="balance.personName"
      >
        <template #append>
          <span :class="balance.balanceCents < 0 ? 'text-error' : 'text-success'">
            {{ balance.balanceCents < 0 ? 'Je dois' : 'On me doit' }} {{ formatEuros(Math.abs(balance.balanceCents)) }}
          </span>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
import type { DebtBalanceRow } from '~/composables/useDebts'

defineProps({
  balances: { type: Array as PropType<DebtBalanceRow[]>, required: true },
})
</script>
