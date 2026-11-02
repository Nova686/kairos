<template>
  <v-dialog
    :model-value="priceCell !== null"
    max-width="720"
    scrollable
    @update:model-value="emit('close')"
  >
    <v-card
      v-if="priceCell"
      :title="`Annonces retenues · ${formatEuros(priceCell.figureCents)}`"
      :subtitle="`Relevé le ${formatParisDate(priceCell.observedAt)} · ${priceCell.listingCount} annonce(s)`"
    >
      <v-card-text>
        <p v-if="priceCell.listings.length === 0">
          Aucune annonce retenue pour ce relevé.
        </p>
        <ul class="retained-listings">
          <li
            v-for="listing in priceCell.listings"
            :key="listing.url"
            class="retained-listings__entry"
          >
            <div class="retained-listings__text">
              <a
                :href="listing.url"
                target="_blank"
                rel="noopener noreferrer"
              >{{ listing.title }}</a>
              <div>
                {{ formatEuros(listing.priceCents) }}
                <span v-if="listing.shippingCents !== null"> + {{ formatEuros(listing.shippingCents) }} de port</span>
                <span v-if="listing.sourceCondition"> · {{ listing.sourceCondition }}</span>
              </div>
            </div>
            <v-btn
              variant="outlined"
              size="small"
              :disabled="excludedListingUrls.includes(listing.url)"
              @click="emit('exclude-listing', listing.url)"
            >
              {{ excludedListingUrls.includes(listing.url) ? 'Exclue' : 'Exclure' }}
            </v-btn>
          </li>
        </ul>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="emit('close')">
          Fermer
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { PriceOverviewCellView } from '~/utils/price-overview-view'

defineProps({
  priceCell: { type: Object as PropType<PriceOverviewCellView | null>, default: null },
  excludedListingUrls: { type: Array as PropType<string[]>, required: true },
})

const emit = defineEmits<{
  'close': []
  'exclude-listing': [listingUrl: string]
}>()
</script>

<style scoped>
.retained-listings {
  display: grid;
  gap: 12px;
  list-style: none;
  padding: 0;
}

.retained-listings__entry {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.retained-listings__text {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
