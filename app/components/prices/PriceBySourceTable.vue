<template>
  <div class="price-by-source">
    <v-table class="price-table kairos-desktop-only">
      <thead>
        <tr>
          <th scope="col">
            Source
          </th>
          <th
            v-for="(column, columnIndex) in columns"
            :key="column.key"
            scope="col"
            :class="{ 'price-table__heading--selected': columnIndex === selectedColumnIndex }"
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
            <span class="price-by-source__source">
              <i
                class="price-by-source__dot"
                :style="{ background: row.color }"
                aria-hidden="true"
              />
              {{ row.label }}
            </span>
          </th>
          <td
            v-for="(priceCell, columnIndex) in row.cells"
            :key="columns[columnIndex]!.key"
          >
            <button
              v-if="priceCell"
              type="button"
              class="price-cell"
              :class="{
                'price-cell--stale': priceCell.isStale,
                'price-cell--retained': priceCell.snapshotId === highlightedSnapshotId,
              }"
              :aria-label="describeCell(row.label, columns[columnIndex]!.label, priceCell)"
              @click="emit('open-cell', priceCell)"
            >
              <span class="price-cell__figure kairos-figure">{{ formatEuros(priceCell.figureCents) }}</span>
              <span class="price-cell__note">
                {{ pluralizeFrench(priceCell.listingCount, 'annonce') }} · {{ formatParisDate(priceCell.observedAt) }}
                <span v-if="priceCell.isStale"> · ancien</span>
              </span>
            </button>
            <span
              v-else
              class="price-by-source__muted"
            >—</span>
          </td>
        </tr>
      </tbody>
    </v-table>

    <ul class="price-source-rows kairos-phone-only">
      <li
        v-for="phoneRow in phoneRows"
        :key="phoneRow.row.source"
      >
        <button
          v-if="phoneRow.selectedCell"
          type="button"
          class="price-source-rows__row"
          :class="{
            'price-source-rows__row--stale': phoneRow.selectedCell.isStale,
            'price-source-rows__row--retained': phoneRow.selectedCell.snapshotId === highlightedSnapshotId,
          }"
          :aria-label="describeCell(phoneRow.row.label, selectedColumnLabel, phoneRow.selectedCell)"
          @click="emit('open-cell', phoneRow.selectedCell)"
        >
          <span class="price-by-source__source">
            <i
              class="price-by-source__dot"
              :style="{ background: phoneRow.row.color }"
              aria-hidden="true"
            />
            {{ phoneRow.row.label }}
          </span>
          <span class="price-source-rows__figure kairos-figure">{{ formatEuros(phoneRow.selectedCell.figureCents) }}</span>
          <span class="price-source-rows__note">
            {{ pluralizeFrench(phoneRow.selectedCell.listingCount, 'annonce') }} · {{ formatParisDate(phoneRow.selectedCell.observedAt) }}<template v-if="phoneRow.selectedCell.isStale"> · ancien</template>
          </span>
          <v-icon
            class="price-source-rows__chevron"
            icon="mdi-chevron-right"
            size="18"
          />
        </button>
        <div
          v-else
          class="price-source-rows__row price-source-rows__row--empty"
        >
          <span class="price-by-source__source">
            <i
              class="price-by-source__dot"
              :style="{ background: phoneRow.row.color }"
              aria-hidden="true"
            />
            {{ phoneRow.row.label }}
          </span>
          <span class="price-by-source__muted">—</span>
        </div>
      </li>
    </ul>

    <div class="price-by-source__references">
      <span class="kairos-label">Référence carte brute</span>
      <span
        v-if="cardReferences.length === 0"
        class="price-by-source__muted"
      >—</span>
      <span
        v-for="reference in cardReferences"
        :key="reference.snapshotId"
        class="price-by-source__reference"
      >
        {{ describeReference(reference) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CardReferenceRowView, PriceColumn, PriceOverviewCellView, PriceRow } from '~/utils/price-overview-view'

const props = defineProps({
  columns: { type: Array as PropType<PriceColumn[]>, required: true },
  rows: { type: Array as PropType<PriceRow[]>, required: true },
  cardReferences: { type: Array as PropType<CardReferenceRowView[]>, required: true },
  selectedColumnIndex: { type: Number, default: -1 },
  highlightedSnapshotId: { type: String as PropType<string | null>, default: null },
})

const emit = defineEmits<{ 'open-cell': [priceCell: PriceOverviewCellView] }>()

const selectedColumnLabel = computed(() => props.columns[props.selectedColumnIndex]?.label ?? '')

const phoneRows = computed(() =>
  props.rows.map(row => ({ row, selectedCell: row.cells[props.selectedColumnIndex] ?? null })))

const describeCell = (sourceLabel: string, columnLabel: string, priceCell: PriceOverviewCellView): string =>
  `${sourceLabel}, ${columnLabel} : ${formatEuros(priceCell.figureCents)}, relevé le ${formatParisDate(priceCell.observedAt)}${priceCell.isStale ? ', ancien' : ''}`

const describeReference = (reference: CardReferenceRowView): string => {
  const figureCents = reference.averageCents ?? reference.trendCents ?? reference.lowCents
  const sourceLabel = cardReferenceSourceLabels[reference.source] ?? reference.source
  return figureCents === null
    ? `${sourceLabel} : —`
    : `${sourceLabel} : ${formatEuros(figureCents)} (${formatParisDate(reference.observedAt)}${reference.isStale ? ', ancien' : ''})`
}
</script>

<style scoped>
.price-by-source {
  display: grid;
  gap: 12px;
}

.price-by-source__source {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.price-by-source__dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.price-by-source__muted {
  color: var(--kairos-text-secondary);
}

.price-by-source__references {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  font-size: 13px;
  color: var(--kairos-text-secondary);
}

.price-by-source__reference {
  font-family: var(--kairos-figure-font);
  white-space: nowrap;
}

.price-table {
  background: transparent;
}

.price-table__heading--selected {
  color: var(--kairos-primary);
}

.price-cell {
  display: grid;
  gap: 1px;
  padding: 8px 10px;
  border-radius: calc(var(--kairos-radius) - 4px);
  background: var(--kairos-surface-variant);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.price-cell--stale {
  opacity: 0.55;
}

.price-cell--retained {
  box-shadow: inset 0 0 0 1.5px var(--kairos-primary);
}

.price-cell__figure {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.price-cell__note {
  font-size: 11.5px;
  color: var(--kairos-text-secondary);
  white-space: nowrap;
}

.price-source-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.price-source-rows__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "source figure"
    "note chevron";
  align-items: baseline;
  gap: 4px 10px;
  width: 100%;
  padding: 10px 8px;
  border-top: 1px solid var(--kairos-border);
  color: inherit;
  text-align: left;
}

.price-source-rows li:first-child .price-source-rows__row {
  border-top: 0;
}

.price-source-rows__row--stale {
  opacity: 0.55;
}

.price-source-rows__row--retained {
  border-radius: calc(var(--kairos-radius) - 4px);
  box-shadow: inset 0 0 0 1.5px var(--kairos-primary);
}

.price-source-rows__row--empty {
  grid-template-areas: "source figure";
}

.price-source-rows__row > :first-child {
  grid-area: source;
}

.price-source-rows__figure {
  grid-area: figure;
  font-weight: 600;
  white-space: nowrap;
}

.price-source-rows__note {
  grid-area: note;
  font-size: 12px;
  color: var(--kairos-text-secondary);
}

.price-source-rows__chevron {
  grid-area: chevron;
  justify-self: end;
  color: var(--kairos-text-secondary);
}

.price-source-rows__row--empty > .price-by-source__muted {
  grid-area: figure;
  justify-self: end;
}
</style>
