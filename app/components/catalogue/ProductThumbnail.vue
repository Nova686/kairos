<template>
  <div
    class="product-thumbnail"
    :class="{ 'kairos-holo kairos-holo--thumbnail': thumbnail.hasHoloBorder }"
    :style="{ '--product-thumbnail-size': `${size}px` }"
    aria-hidden="true"
  >
    <img
      v-if="thumbnail.imageSource"
      class="product-thumbnail__image"
      :src="thumbnail.imageSource"
      alt=""
      loading="lazy"
    >
    <v-icon
      v-else
      class="product-thumbnail__glyph"
      :icon="thumbnail.glyph"
      :size="Math.round(size * 0.46)"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  category: { type: String, required: true },
  imageUrl: { type: String as PropType<string | null>, default: null },
  size: { type: Number, default: 52 },
})

const thumbnail = computed(() => describeProductThumbnail(props.category, props.imageUrl))
</script>

<style scoped>
.product-thumbnail {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--product-thumbnail-size);
  height: var(--product-thumbnail-size);
  overflow: hidden;
  border-radius: calc(var(--kairos-radius) - 4px);
  color: var(--kairos-text-secondary);
}

.product-thumbnail:not(.kairos-holo) {
  border: 1px solid var(--kairos-border);
  background: var(--kairos-surface-variant);
}

.product-thumbnail__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
