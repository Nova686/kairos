<template>
  <div class="product-candidate-picker">
    <div v-if="identifiedCandidates.length > 0">
      <div class="kairos-label product-candidate-picker__group">
        Résultats du scan
      </div>
      <v-list
        bg-color="transparent"
        class="pa-0"
      >
        <v-list-item
          v-for="candidate in identifiedCandidates"
          :key="`identified-${candidate.origin}-${candidate.label}`"
          :title="candidate.label"
          :subtitle="describeCandidate(candidate)"
          rounded="lg"
          @click="pickCandidate(candidate)"
        >
          <template #prepend>
            <ProductThumbnail
              class="mr-3"
              :category="candidate.draft.category"
              :image-url="candidate.imageUrl"
            />
          </template>
          <template #append>
            <v-chip
              color="primary"
              prepend-icon="mdi-plus"
            >
              Ajouter
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </div>
    <v-text-field
      v-model="searchText"
      label="Rechercher un produit"
      :autofocus="focusSearch"
      prepend-inner-icon="mdi-magnify"
      :loading="isSearching"
      clearable
      hide-details
    />
    <v-alert
      v-if="searchErrorMessage"
      type="error"
      role="alert"
    >
      {{ searchErrorMessage }}
    </v-alert>
    <p
      v-for="unavailableMessage in unavailableMessages"
      :key="unavailableMessage"
      class="text-medium-emphasis"
    >
      {{ unavailableMessage }}
    </p>
    <div
      v-for="candidateGroup in candidateGroups"
      :key="candidateGroup.origin"
    >
      <div class="kairos-label product-candidate-picker__group">
        {{ candidateGroup.title }}
      </div>
      <v-list
        bg-color="transparent"
        class="pa-0"
      >
        <v-list-item
          v-for="candidate in candidateGroup.candidates"
          :key="`${candidate.origin}-${candidate.label}`"
          :title="candidate.label"
          :subtitle="describeCandidate(candidate)"
          rounded="lg"
          @click="pickCandidate(candidate)"
        >
          <template #prepend>
            <ProductThumbnail
              class="mr-3"
              :category="candidate.draft.category"
              :image-url="candidate.imageUrl"
            />
          </template>
          <template #append>
            <v-icon
              v-if="candidate.origin === 'catalogue'"
              icon="mdi-check-circle"
              color="primary"
            />
            <v-chip
              v-else
              prepend-icon="mdi-plus"
            >
              Créer
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </div>
    <v-alert
      v-if="errorMessage"
      type="error"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <v-form
      class="product-candidate-picker__creation"
      @submit.prevent="createBlankProduct"
    >
      <v-text-field
        v-model="newProductName"
        class="product-candidate-picker__name"
        label="Nom du nouveau produit"
        hide-details
      />
      <v-select
        v-model="newProductCategory"
        label="Catégorie"
        :items="categoryOptions"
        hide-details
      />
      <v-btn
        type="submit"
        color="primary"
        height="56"
        :loading="isCreating"
      >
        Créer un produit
      </v-btn>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { productCategories, productCategoryLabels } from '~~/shared/catalogue/product-category'
import type { ProductReference } from '~~/shared/catalogue/product-reference'

import type { ProductCandidate } from '~~/server/domain/catalogue/search-product-candidates'

const props = withDefaults(defineProps<{
  identifiedCandidates?: ProductCandidate[]
  pendingBarcode?: string | null
  focusSearch?: boolean
}>(), { identifiedCandidates: () => [], pendingBarcode: null, focusSearch: false })

const emit = defineEmits<{ picked: [product: ProductReference] }>()

const describeCandidate = (candidate: ProductCandidate): string =>
  props.pendingBarcode ? 'Lier ce code-barres à ce produit' : productCategoryLabels[candidate.draft.category]

const categoryOptions = productCategories.map(category => ({ value: category, title: productCategoryLabels[category] }))

const { searchText, candidateGroups, unavailableMessages, isSearching, searchErrorMessage } = useProductSearch()
const { errorMessage, isCreating, newProductName, newProductCategory, pickCandidate, createBlankProduct } = useProductPicking(
  product => emit('picked', product),
)
</script>

<style scoped>
.product-candidate-picker {
  display: grid;
  gap: 12px;
}

.product-candidate-picker__group {
  padding: 4px 0 6px;
}

.product-candidate-picker__creation {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.product-candidate-picker__name {
  grid-column: 1 / -1;
}
</style>
