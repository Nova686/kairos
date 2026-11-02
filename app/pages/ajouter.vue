<template>
  <div>
    <h1 class="text-h5 mb-4">
      Ajouter un achat
    </h1>
    <ProductCandidatePicker @picked="addPickedProduct" />
    <PurchaseForm ref="purchaseForm" />
  </div>
</template>

<script setup lang="ts">
import type { ProductReference } from '~~/shared/catalogue/product-reference'

const purchaseForm = useTemplateRef('purchaseForm')

const addPickedProduct = (product: ProductReference) => {
  purchaseForm.value?.addLine(product)
}
</script>
