<template>
  <div>
    <v-table class="price-table d-none d-md-block">
      <thead>
        <tr>
          <th scope="col">
            Source
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.source"
        >
          <th scope="row">
            {{ row.label }}
          </th>
          <td
            v-for="(priceCell, columnIndex) in row.cells"
            :key="columns[columnIndex]!.key"
          >
            <v-btn
              v-if="priceCell"
              variant="text"
              :class="{ 'price-table__stale': priceCell.isStale }"
              :aria-label="describeCell(row.label, columns[columnIndex]!.label, priceCell)"
              @click="emit('open-cell', priceCell)"
            >
              <span class="price-table__figure">{{ formatEuros(priceCell.figureCents) }}</span>
              <span class="price-table__date">{{ formatParisDate(priceCell.observedAt) }}</span>
              <v-chip
                v-if="priceCell.isStale"
                size="x-small"
                class="ml-2"
              >
                ancien
              </v-chip>
            </v-btn>
            <span v-else>—</span>
          </td>
        </tr>
        <tr class="price-table__reference">
          <th scope="row">
            Référence carte brute
          </th>
          <td :colspan="Math.max(columns.length, 1)">
            <span v-if="cardReferences.length === 0">—</span>
            <span
              v-for="reference in cardReferences"
              :key="reference.snapshotId"
              class="price-table__reference-source"
            >
              {{ describeReference(reference) }}
            </span>
          </td>
        </tr>
      </tbody>
    </v-table>

    <div class="price-cards d-md-none">
      <v-card
        v-for="row in rows"
        :key="row.source"
        :title="row.label"
        variant="outlined"
      >
        <v-card-text>
          <p
            v-if="row.cells.every(priceCell => priceCell === null)"
            class="mb-0"
          >
            Aucun prix relevé.
          </p>
          <template
            v-for="(priceCell, columnIndex) in row.cells"
            :key="columns[columnIndex]!.key"
          >
            <div
              v-if="priceCell"
              class="price-cards__line"
            >
              <span>{{ columns[columnIndex]!.label }}</span>
              <v-btn
                variant="text"
                :class="{ 'price-table__stale': priceCell.isStale }"
                :aria-label="describeCell(row.label, columns[columnIndex]!.label, priceCell)"
                @click="emit('open-cell', priceCell)"
              >
                <span class="price-table__figure">{{ formatEuros(priceCell.figureCents) }}</span>
                <span class="price-table__date">{{ formatParisDate(priceCell.observedAt) }}</span>
                <v-chip
                  v-if="priceCell.isStale"
                  size="x-small"
                  class="ml-2"
                >
                  ancien
                </v-chip>
              </v-btn>
            </div>
          </template>
        </v-card-text>
      </v-card>
      <v-card
        title="Référence carte brute"
        variant="outlined"
      >
        <v-card-text>
          <p v-if="cardReferences.length === 0">
            —
          </p>
          <p
            v-for="reference in cardReferences"
            :key="reference.snapshotId"
          >
            {{ describeReference(reference) }}
          </p>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CardReferenceRowView, PriceColumn, PriceOverviewCellView, PriceRow } from '~/utils/price-overview-view'

defineProps({
  columns: { type: Array as PropType<PriceColumn[]>, required: true },
  rows: { type: Array as PropType<PriceRow[]>, required: true },
  cardReferences: { type: Array as PropType<CardReferenceRowView[]>, required: true },
})

const emit = defineEmits<{ 'open-cell': [priceCell: PriceOverviewCellView] }>()

const describeCell = (sourceLabel: string, columnLabel: string, priceCell: PriceOverviewCellView): string =>
  `${sourceLabel}, ${columnLabel} : ${formatEuros(priceCell.figureCents)}, relevé le ${formatParisDate(priceCell.observedAt)}${priceCell.isStale ? ', ancien' : ''}`

const describeReference = (reference: CardReferenceRowView): string => {
  const figureCents = reference.averageCents ?? reference.trendCents ?? reference.lowCents
  const sourceLabel = cardReferenceSourceLabels[reference.source] ?? reference.source
  return figureCents === null
    ? `${sourceLabel} : —`
    : `${sourceLabel} : ${formatEuros(figureCents)} (${formatParisDate(reference.observedAt)})`
}
</script>

<style scoped>
.price-table__stale {
  opacity: 0.5;
}

.price-table__figure {
  font-weight: 500;
  margin-right: 8px;
}

.price-table__date {
  font-size: 0.75rem;
}

.price-table__reference {
  font-style: italic;
}

.price-table__reference-source {
  margin-right: 16px;
}

.price-cards {
  display: grid;
  gap: 12px;
}

.price-cards__line {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
</style>
