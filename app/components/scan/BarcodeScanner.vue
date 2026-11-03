<template>
  <div class="barcode-scanner">
    <v-switch
      v-model="isPsaMode"
      label="Carte gradée PSA (numéro de certificat)"
      hide-details
    />
    <div
      v-show="cameraState === 'scanning' || cameraState === 'starting'"
      class="barcode-scanner__viewport"
    >
      <video
        ref="videoElement"
        class="barcode-scanner__video"
        autoplay
        playsinline
        muted
        aria-label="Aperçu de l’appareil photo"
      />
    </div>
    <v-alert
      v-if="cameraState === 'denied'"
      type="warning"
      class="my-4"
      role="alert"
    >
      Autorisez l’appareil photo dans Réglages › Safari, ou saisissez le code ci-dessous.
    </v-alert>
    <v-alert
      v-else-if="cameraState === 'unavailable'"
      type="warning"
      class="my-4"
      role="alert"
    >
      L’appareil photo n’est pas disponible : saisissez le code ci-dessous.
    </v-alert>
    <v-btn
      v-if="cameraState === 'scanning' || cameraState === 'starting'"
      class="my-4"
      prepend-icon="mdi-stop"
      :loading="cameraState === 'starting'"
      @click="stop"
    >
      Arrêter la caméra
    </v-btn>
    <v-btn
      v-else
      class="my-4"
      color="primary"
      prepend-icon="mdi-barcode-scan"
      @click="start"
    >
      {{ lastCode === null ? "Scanner avec la caméra" : "Scanner un autre code" }}
    </v-btn>
    <v-form
      class="barcode-scanner__manual"
      @submit.prevent="submitManualCode"
    >
      <v-text-field
        v-model="manualCode"
        :label="isPsaMode ? 'Numéro de certificat' : 'Code-barres'"
        inputmode="numeric"
        hide-details
      />
      <v-btn
        type="submit"
        height="56"
        :disabled="manualCode.trim() === ''"
      >
        Rechercher
      </v-btn>
    </v-form>
  </div>
</template>

<script setup lang="ts">
const isPsaMode = defineModel<boolean>('psaMode', { default: false })
const emit = defineEmits<{ codeSubmitted: [code: string] }>()

const { videoElement, start, stop, lastCode, cameraState } = useBarcodeScanner()
const manualCode = ref('')

watch(lastCode, (scannedCode) => {
  if (scannedCode !== null) {
    manualCode.value = scannedCode
    emit('codeSubmitted', scannedCode)
  }
})

const submitManualCode = () => {
  emit('codeSubmitted', manualCode.value)
}
</script>

<style scoped>
.barcode-scanner__viewport {
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: 8px;
  margin-top: 12px;
  max-width: 480px;
  overflow: hidden;
}

.barcode-scanner__video {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.barcode-scanner__manual {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr auto;
}
</style>
