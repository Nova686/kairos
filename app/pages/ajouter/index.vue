<template>
  <div>
    <h1 class="text-h5 mb-4">
      Ajouter un achat
    </h1>
    <v-tabs
      v-model="activeTab"
      class="mb-4"
    >
      <v-tab value="code-barres">
        Code-barres
      </v-tab>
      <v-tab value="photo">
        Photo
      </v-tab>
      <v-tab value="texte">
        Texte
      </v-tab>
    </v-tabs>
    <v-tabs-window v-model="activeTab">
      <v-tabs-window-item value="code-barres">
        <BarcodeScanner
          v-if="activeTab === 'code-barres'"
          v-model:psa-mode="isPsaMode"
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
        <ProductCandidatePicker
          v-if="identifiedCandidates.length > 0 || pendingBarcode !== null"
          :key="pendingBarcode ?? 'psa-scan'"
          :identified-candidates="identifiedCandidates"
          :pending-barcode="pendingBarcode"
          :focus-search="isUnknownCode"
          @picked="pickProduct"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="photo">
        <PhotoCapture
          v-if="activeTab === 'photo'"
          ref="photoCapture"
          @product-ready="addPickedProduct"
          @product-withdrawn="removePickedProduct"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="texte">
        <ProductCandidatePicker @picked="addPickedProduct" />
      </v-tabs-window-item>
    </v-tabs-window>
    <PurchaseForm
      ref="purchaseForm"
      @purchase-recorded="confirmPhotoAutoPick"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProductReference } from '~~/shared/catalogue/product-reference'

const purchaseForm = useTemplateRef('purchaseForm')
const { activeTab } = useAddProductTabs()

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
