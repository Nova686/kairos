<template>
  <span v-if="trackingReference === null">—</span>
  <a
    v-else-if="isTrackingLink(trackingReference)"
    :href="trackingReference"
    target="_blank"
    rel="noopener"
  >
    {{ trackingReference }}
  </a>
  <span v-else>
    <span class="tracking-reference__text">{{ trackingReference }}</span>
    <v-btn
      :icon="copyButtonIcon"
      size="x-small"
      variant="text"
      aria-label="Copier la référence de suivi"
      @click="copyTrackingReference"
    />
    <span
      role="status"
      class="tracking-reference__status"
    >{{ copyStatusMessage }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps({
  trackingReference: { type: String as PropType<string | null>, default: null },
})

const { copyOutcome, copyText } = useClipboardCopy()

const copyButtonIcon = computed(() => (copyOutcome.value === 'copied' ? 'mdi-check' : 'mdi-content-copy'))

const copyStatusMessage = computed(() => ({ idle: '', copied: 'Copiée', failed: 'Copie impossible' })[copyOutcome.value])

const copyTrackingReference = async () => {
  if (props.trackingReference !== null) {
    await copyText(props.trackingReference)
  }
}
</script>

<style scoped>
.tracking-reference__status {
  font-size: 0.75rem;
  color: var(--kairos-text-secondary);
}
</style>
