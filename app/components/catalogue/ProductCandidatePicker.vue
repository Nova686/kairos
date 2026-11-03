<template>
  <div>
    <v-list v-if="identifiedCandidates.length > 0">
      <v-list-subheader>Résultats du scan</v-list-subheader>
      <v-list-item
        v-for="candidate in identifiedCandidates"
        :key="`identified-${candidate.origin}-${candidate.label}`"
        :title="candidate.label"
        :subtitle="pendingBarcode ? 'Lier ce code-barres à ce produit' : undefined"
        @click="pickCandidate(candidate)"
      >
        <template
          v-if="candidate.imageUrl"
          #prepend
        >
          <v-avatar
            :image="candidate.imageUrl"
            rounded
          />
        </template>
      </v-list-item>
    </v-list>
    <v-text-field
      v-model="searchText"
      label="Rechercher un produit"
      :autofocus="focusSearch"
      prepend-inner-icon="mdi-magnify"
      :loading="isSearching"
      clearable
    />
    <v-alert
      v-if="searchErrorMessage"
      type="error"
      class="mb-4"
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
    <v-list
      v-for="candidateGroup in candidateGroups"
      :key="candidateGroup.origin"
    >
      <v-list-subheader>{{ candidateGroup.title }}</v-list-subheader>
      <v-list-item
        v-for="candidate in candidateGroup.candidates"
        :key="`${candidate.origin}-${candidate.label}`"
        :title="candidate.label"
        :subtitle="pendingBarcode ? 'Lier ce code-barres à ce produit' : undefined"
        @click="pickCandidate(candidate)"
      >
        <template
          v-if="candidate.imageUrl"
          #prepend
        >
          <v-avatar
            :image="candidate.imageUrl"
            rounded
          />
        </template>
      </v-list-item>
    </v-list>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="mb-4"
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

withDefaults(defineProps<{
  identifiedCandidates?: ProductCandidate[]
  pendingBarcode?: string | null
  focusSearch?: boolean
}>(), { identifiedCandidates: () => [], pendingBarcode: null, focusSearch: false })

const emit = defineEmits<{ picked: [product: ProductReference] }>()

const categoryOptions = productCategories.map(category => ({ value: category, title: productCategoryLabels[category] }))

const { searchText, candidateGroups, unavailableMessages, isSearching, searchErrorMessage } = useProductSearch()
const { errorMessage, isCreating, newProductName, newProductCategory, pickCandidate, createBlankProduct } = useProductPicking(
  product => emit('picked', product),
)
</script>

<style scoped>
.product-candidate-picker__creation {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}
</style>
