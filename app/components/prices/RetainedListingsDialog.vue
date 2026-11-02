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
      :subtitle="`Relevé le ${formatParisDate(priceCell.observedAt)} · ${priceCell.listingCount} ${priceCell.listings.some(listing => listing.authorName !== null || listing.title === 'Prix saisi manuellement') ? 'prix saisi(s)' : 'annonce(s)'}`"
    >
      <v-card-text>
        <p v-if="priceCell.listings.length === 0">
          Aucune annonce retenue pour ce relevé.
        </p>
        <ul class="retained-listings">
          <li
            v-for="(listing, listingIndex) in priceCell.listings"
            :key="`${listing.url ?? 'manual'}-${listingIndex}`"
            class="retained-listings__entry"
          >
            <div class="retained-listings__text">
              <a
                v-if="safeExternalHref(listing.url)"
                :href="safeExternalHref(listing.url)"
                target="_blank"
                rel="noopener noreferrer"
              >{{ listing.title }}</a>
              <span v-else>{{ listing.title }}</span>
              <div>
                {{ formatEuros(listing.priceCents) }}
                <span v-if="listing.shippingCents !== null"> + {{ formatEuros(listing.shippingCents) }} de port</span>
                <span v-if="listing.sourceCondition"> · {{ listing.sourceCondition }}</span>
                <span v-if="listing.observedAt"> · {{ formatParisDate(listing.observedAt) }}</span>
                <span v-if="listing.authorName"> · {{ listing.authorName }}</span>
                <span v-if="listing.url && !safeExternalHref(listing.url)"> · lien non cliquable : {{ listing.url }}</span>
              </div>
            </div>
            <template v-if="listing.url">
              <v-chip
                v-if="listing.isExcluded"
                size="small"
              >
                exclue
              </v-chip>
              <v-btn
                v-if="listing.isExcluded"
                variant="outlined"
                size="small"
                @click="emit('restore-listing', listing.url)"
              >
                Rétablir
              </v-btn>
              <v-btn
                v-else-if="priceCell.source === 'ebay'"
                variant="outlined"
                size="small"
                @click="emit('exclude-listing', listing.url)"
              >
                Exclure
              </v-btn>
            </template>
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
})

const emit = defineEmits<{
  'close': []
  'exclude-listing': [listingUrl: string]
  'restore-listing': [listingUrl: string]
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
