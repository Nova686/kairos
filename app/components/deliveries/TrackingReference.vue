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
      icon="mdi-content-copy"
      size="x-small"
      variant="text"
      aria-label="Copier la référence de suivi"
      @click="copyTrackingReference"
    />
  </span>
</template>

<script setup lang="ts">
const props = defineProps({
  trackingReference: { type: String as PropType<string | null>, default: null },
})

const copyTrackingReference = async () => {
  if (props.trackingReference !== null) {
    await navigator.clipboard.writeText(props.trackingReference)
  }
}
</script>
