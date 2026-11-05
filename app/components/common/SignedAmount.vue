<template>
  <span
    class="signed-amount kairos-figure"
    :class="gainTone"
  >{{ formatSignedEuros(cents) }}</span>
</template>

<script setup lang="ts">
const props = defineProps({
  cents: { type: Number, required: true },
})

const gainTone = computed(() => describeGainTone(props.cents))
</script>

<style scoped>
.signed-amount {
  white-space: nowrap;
}
</style>
