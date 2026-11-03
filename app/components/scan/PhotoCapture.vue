<template>
  <div class="photo-capture">
    <input
      ref="fileInput"
      class="photo-capture__input"
      type="file"
      accept="image/*"
      capture="environment"
      aria-label="Photographier le produit"
      @change="analyseSelectedPhoto"
    >
    <v-btn
      color="primary"
      prepend-icon="mdi-camera"
      :disabled="isAnalysing"
      @click="openCamera"
    >
      {{ previewUrl === null ? "Photographier le produit" : "Reprendre une photo" }}
    </v-btn>
    <img
      v-if="previewUrl !== null"
      :src="previewUrl"
      class="photo-capture__preview"
      alt="Photo du produit à identifier"
    >
    <div
      v-if="isAnalysing"
      class="photo-capture__progress"
      role="status"
    >
      <v-progress-circular
        indeterminate
        size="24"
      />
      <span>Analyse…</span>
    </div>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="my-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <v-alert
      v-for="degradedMessage in degradedMessages"
      :key="degradedMessage"
      type="warning"
      class="my-4"
      role="status"
    >
      {{ degradedMessage }}
    </v-alert>
    <p
      v-if="unavailableSources.length > 0"
      class="text-medium-emphasis"
    >
      Sources indisponibles : {{ unavailableSources.join(', ') }}
    </p>
    <v-alert
      v-if="autoPickedProduct"
      type="success"
      class="my-4"
      role="status"
    >
      Produit reconnu : {{ autoPickedProduct.name }}.
      <a
        href="#"
        class="photo-capture__reject"
        @click.prevent="rejectAutoPick"
      >Ce n’est pas le bon</a>
    </v-alert>
    <v-alert
      v-else-if="hasAnalysed && candidates.length === 0"
      type="info"
      class="my-4"
      role="status"
    >
      Aucun produit reconnu : cherchez-le ou créez-le ci-dessous.
    </v-alert>
    <ProductCandidatePicker
      v-if="hasAnalysed && autoPickedProduct === null"
      :identified-candidates="candidates"
      @picked="pickProduct"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProductReference } from '~~/shared/catalogue/product-reference'
import type { ScanRequestSender } from '~/composables/useScanIdentification'

const emit = defineEmits<{
  productReady: [product: ProductReference]
  productWithdrawn: [productId: string]
}>()

const {
  isAnalysing,
  errorMessage,
  candidates,
  autoPickedProduct,
  degradedMessages,
  unavailableSources,
  hasAnalysed,
  analyse,
  rejectAutoPick,
  pickProduct,
  confirmAutoPick,
} = usePhotoIdentification(
  {
    onProductReady: product => emit('productReady', product),
    onProductWithdrawn: productId => emit('productWithdrawn', productId),
  },
  $fetch as ScanRequestSender,
  resizePhoto,
)

defineExpose({ confirmAutoPick })

const fileInput = useTemplateRef('fileInput')
const previewUrl = ref<string | null>(null)

const openCamera = () => {
  fileInput.value?.click()
}

const replacePreview = (file: File) => {
  if (previewUrl.value !== null) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(file)
}

const analyseSelectedPhoto = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const selectedFile = input.files?.[0]
  input.value = ''
  if (!selectedFile) {
    return
  }
  replacePreview(selectedFile)
  await analyse(selectedFile)
}

onBeforeUnmount(() => {
  if (previewUrl.value !== null) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>

<style scoped>
.photo-capture__input {
  display: none;
}

.photo-capture__preview {
  border-radius: 8px;
  display: block;
  margin-top: 12px;
  max-height: 240px;
  max-width: 100%;
}

.photo-capture__progress {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.photo-capture__reject {
  color: inherit;
  margin-left: 8px;
  text-decoration: underline;
}
</style>
