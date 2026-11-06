<template>
  <v-form
    class="ebay-search-settings"
    @submit.prevent="submitEbaySettings"
  >
    <v-text-field
      v-model="ebayQuery"
      label="Recherche eBay"
      hint="Laissez vide pour utiliser le nom du produit."
      persistent-hint
    />
    <v-combobox
      v-model="excludedKeywords"
      label="Mots exclus"
      hint="Les annonces dont le titre contient un de ces mots sont écartées."
      persistent-hint
      multiple
      chips
      closable-chips
    />
    <div class="d-flex align-center ga-4">
      <v-btn
        type="submit"
        color="primary"
      >
        Enregistrer
      </v-btn>
      <span
        v-if="savedMessage"
        role="status"
      >{{ savedMessage }}</span>
    </div>
  </v-form>
</template>

<script setup lang="ts">
const props = defineProps({
  ebayQuery: { type: String as PropType<string | null>, default: null },
  excludedKeywords: { type: Array as PropType<string[]>, required: true },
  saveEbaySettings: {
    type: Function as PropType<(ebayQuery: string | null, ebayExcludedKeywords: string[]) => Promise<boolean>>,
    required: true,
  },
})

const { ebayQuery, excludedKeywords, savedMessage, submitEbaySettings } = useEbaySearchSettings(
  () => props.ebayQuery,
  () => props.excludedKeywords,
  (query, keywords) => props.saveEbaySettings(query, keywords),
)
</script>

<style scoped>
.ebay-search-settings {
  display: grid;
  gap: 12px;
  max-width: 560px;
}
</style>
