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
      <div
        class="barcode-scanner__frame"
        aria-hidden="true"
      />
      <div
        class="barcode-scanner__laser"
        aria-hidden="true"
      />
      <p class="barcode-scanner__hint">
        Placez le code-barres dans le cadre
      </p>
    </div>
    <v-alert
      v-if="cameraState === 'denied'"
      type="warning"
      class="my-4"
      role="alert"
    >
      Autorisez l’appareil photo dans Réglages › Safari, saisissez le code ci-dessous
      <NuxtLink :to="{ query: { onglet: 'photo' } }">
        ou prenez une photo
      </NuxtLink>.
    </v-alert>
    <v-alert
      v-else-if="cameraState === 'unavailable'"
      type="warning"
      class="my-4"
      role="alert"
    >
      L’appareil photo n’est pas disponible : saisissez le code ci-dessous
      <NuxtLink :to="{ query: { onglet: 'photo' } }">
        ou prenez une photo
      </NuxtLink>.
    </v-alert>
    <v-btn
      v-if="cameraState === 'scanning' || cameraState === 'starting'"
      class="my-4"
      block
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
  position: relative;
  aspect-ratio: 4 / 3;
  max-width: 100%;
  margin-top: 12px;
  overflow: hidden;
  border-radius: var(--kairos-radius);
  background: radial-gradient(120% 90% at 30% 20%, #3b4552, #14181e 70%);
}

.barcode-scanner__video {
  position: absolute;
  inset: 0;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.barcode-scanner__frame {
  position: absolute;
  inset: 24% 14%;
  border-radius: 12px;
}

.barcode-scanner__frame::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 3px solid var(--kairos-accent);
  border-radius: 12px;
  clip-path: polygon(0 0, 22% 0, 22% 100%, 0 100%, 0 0, 100% 0, 100% 100%, 78% 100%, 78% 0);
}

.barcode-scanner__laser {
  position: absolute;
  top: 50%;
  right: 16%;
  left: 16%;
  height: 2px;
  background: var(--kairos-accent);
  box-shadow: 0 0 12px var(--kairos-accent);
}

.barcode-scanner__hint {
  position: absolute;
  right: 0;
  bottom: 12px;
  left: 0;
  margin: 0;
  color: #e8edf2;
  font-size: 12.5px;
  text-align: center;
}

@media (prefers-reduced-motion: no-preference) {
  .barcode-scanner__laser {
    animation: barcode-scanner-sweep 2.4s ease-in-out infinite;
  }
}

@keyframes barcode-scanner-sweep {
  0%,
  100% {
    transform: translateY(-36px);
  }

  50% {
    transform: translateY(36px);
  }
}

.barcode-scanner__manual {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr auto;
}
</style>
