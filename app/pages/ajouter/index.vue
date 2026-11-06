<template>
  <div class="add-page">
    <div class="add-page__heading">
      <h1 class="kairos-page-title">
        Ajouter un achat
      </h1>
      <p class="kairos-page-subtitle">
        Cherchez le produit par son nom ou son code EAN, puis complétez l’achat.
      </p>
    </div>
    <div
      class="add-page__layout"
      :class="{ 'add-page__layout--scan': isCameraScanAvailable }"
    >
      <div
        v-if="isCameraScanAvailable"
        class="add-page__sources"
      >
        <v-tabs
          v-model="displayedTab"
          color="primary"
        >
          <v-tab
            value="code-barres"
            prepend-icon="mdi-barcode-scan"
          >
            Code-barres
          </v-tab>
          <v-tab
            v-if="isPhotoRecognitionAvailable"
            value="photo"
            prepend-icon="mdi-camera"
          >
            Photo
          </v-tab>
          <v-tab
            value="texte"
            prepend-icon="mdi-format-text"
          >
            Texte
          </v-tab>
        </v-tabs>
        <p
          v-if="!isPhotoRecognitionAvailable"
          class="text-caption text-medium-emphasis"
          role="status"
        >
          Reconnaissance photo désactivée sur ce serveur : utilisez le code-barres ou le texte.
        </p>
        <v-tabs-window v-model="displayedTab">
          <v-tabs-window-item value="code-barres">
            <BarcodeScanner
              v-if="displayedTab === 'code-barres'"
              v-model:psa-mode="isPsaMode"
              :photo-recognition-available="isPhotoRecognitionAvailable"
              @code-submitted="identify"
            />
            <v-progress-linear
              v-if="isIdentifying"
              indeterminate
              class="my-4"
            />
            <v-alert
              v-if="scanErrorMessage"
              type="error"
              class="my-4"
              role="alert"
            >
              {{ scanErrorMessage }}
            </v-alert>
            <v-alert
              v-if="noticeMessage"
              type="success"
              class="my-4"
              role="status"
            >
              {{ noticeMessage }}
            </v-alert>
            <v-alert
              v-if="isUnknownCode"
              type="info"
              class="my-4"
              role="status"
            >
              Code inconnu : cherchez le produit par son nom, le code-barres lui sera associé.
            </v-alert>
            <p
              v-if="unavailableSourcesMessage"
              class="text-medium-emphasis"
            >
              {{ unavailableSourcesMessage }}
            </p>
            <v-card
              v-if="identifiedCandidates.length > 0 || pendingBarcode !== null"
              class="add-page__card"
            >
              <ProductCandidatePicker
                :key="pendingBarcode ?? 'psa-scan'"
                :identified-candidates="identifiedCandidates"
                :pending-barcode="pendingBarcode"
                :focus-search="isUnknownCode"
                @picked="pickProduct"
              />
            </v-card>
          </v-tabs-window-item>
          <v-tabs-window-item
            v-if="isPhotoRecognitionAvailable"
            value="photo"
          >
            <PhotoCapture
              v-if="displayedTab === 'photo'"
              ref="photoCapture"
              @product-ready="addPickedProduct"
              @product-withdrawn="removePickedProduct"
            />
          </v-tabs-window-item>
          <v-tabs-window-item value="texte">
            <v-card class="add-page__card">
              <ProductCandidatePicker @picked="addPickedProduct" />
            </v-card>
          </v-tabs-window-item>
        </v-tabs-window>
      </div>
      <div
        v-else
        class="add-page__sources"
      >
        <v-card class="add-page__card">
          <ProductCandidatePicker @picked="addPickedProduct" />
        </v-card>
        <p class="add-page__note">
          <v-icon icon="mdi-cellphone" />
          Le scan par code-barres et par photo se fait depuis l’iPhone.
        </p>
      </div>
      <PurchaseForm
        ref="purchaseForm"
        @purchase-recorded="confirmPhotoAutoPick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProductReference } from '~~/shared/catalogue/product-reference'

const purchaseForm = useTemplateRef('purchaseForm')
const { activeTab } = useAddProductTabs()
const { isPhotoRecognitionAvailable } = await useServerFeatures()
const { isCameraScanAvailable } = useCameraScanCapability()

const availableTabs = computed(() =>
  buildAddModeTabs({
    cameraScanAvailable: isCameraScanAvailable.value,
    photoRecognitionAvailable: isPhotoRecognitionAvailable.value,
  }),
)

const displayedTab = computed({
  get: () => resolveDisplayedAddTab(activeTab.value, availableTabs.value),
  set: (selectedTab) => {
    activeTab.value = selectedTab
  },
})

const addPickedProduct = (product: ProductReference, prefill: ScanProductPrefill | null = null) => {
  purchaseForm.value?.addLine(product, prefill)
}

const photoCapture = useTemplateRef('photoCapture')

const confirmPhotoAutoPick = (purchasedProductIds: string[]) => {
  photoCapture.value?.confirmPurchasedPick(purchasedProductIds)
}

const removePickedProduct = (productId: string) => {
  purchaseForm.value?.removeLatestLineOfProduct(productId)
}

const {
  isPsaMode,
  isIdentifying,
  errorMessage: scanErrorMessage,
  noticeMessage,
  identifiedCandidates,
  unavailableSourcesMessage,
  isUnknownCode,
  pendingBarcode,
  identify,
  pickProduct,
} = useScanIdentification(addPickedProduct, $fetch as ScanRequestSender)
</script>

<style scoped>
.add-page {
  display: grid;
  gap: 16px;
  align-content: start;
}

.add-page__layout {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
}

.add-page__layout--scan {
  grid-template-columns: minmax(0, 1fr);
}

.add-page__sources {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.add-page__card {
  padding: 18px;
}

.add-page__note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed var(--kairos-border);
  border-radius: calc(var(--kairos-radius) - 4px);
  color: var(--kairos-text-secondary);
  font-size: 13px;
}
</style>
