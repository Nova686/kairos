<template>
  <v-text-field
    v-model="typedAmount"
    :label="label"
    inputmode="decimal"
    suffix="€"
    :error-messages="amountErrorMessages"
    :hide-details="amountErrorMessages.length === 0"
  />
</template>

<script setup lang="ts">
defineProps({
  label: { type: String, required: true },
})

const typedAmount = defineModel<string>({ required: true })

const amountErrorMessages = computed(() =>
  typedAmount.value.trim() === '' || parseEuroInput(typedAmount.value) !== null ? [] : ['Montant invalide'],
)
</script>
