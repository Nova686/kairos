<template>
  <div>
    <h1 class="text-h5 mb-4">
      {{ title }}
    </h1>
    <v-form
      class="d-flex ga-2 mb-4"
      @submit.prevent="addRow"
    >
      <v-text-field
        v-model="newText"
        :label="addLabel"
        hide-details
      />
      <v-btn
        type="submit"
        color="primary"
        height="56"
      >
        Ajouter
      </v-btn>
    </v-form>
    <v-alert
      v-if="errorMessage"
      type="error"
      class="mb-4"
      role="alert"
    >
      {{ errorMessage }}
    </v-alert>
    <v-progress-linear
      v-if="pending"
      indeterminate
    />
    <p
      v-else-if="labelledRows.length === 0"
    >
      {{ emptyMessage }}
    </p>
    <v-list v-else>
      <v-list-item
        v-for="labelledRow in labelledRows"
        :key="labelledRow.id"
      >
        <v-form
          v-if="editedRowId === labelledRow.id"
          class="d-flex ga-2"
          @submit.prevent="saveEditing"
        >
          <v-text-field
            v-model="editedText"
            :label="addLabel"
            density="compact"
            hide-details
          />
          <v-btn
            type="submit"
            color="primary"
          >
            Enregistrer
          </v-btn>
          <v-btn
            variant="text"
            @click="cancelEditing"
          >
            Annuler
          </v-btn>
        </v-form>
        <v-list-item-title v-else>
          {{ labelledRow.text }}
        </v-list-item-title>
        <template #append>
          <template v-if="editedRowId !== labelledRow.id">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              :aria-label="`Renommer ${labelledRow.text}`"
              @click="startEditing(labelledRow.id, labelledRow.text)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              :aria-label="`Supprimer ${labelledRow.text}`"
              @click="deleteRow(labelledRow.id)"
            />
          </template>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  endpoint: { type: String, required: true },
  fieldName: { type: String as PropType<'label' | 'name'>, required: true },
  title: { type: String, required: true },
  addLabel: { type: String, required: true },
  emptyMessage: { type: String, required: true },
})

const {
  labelledRows,
  newText,
  editedRowId,
  editedText,
  pending,
  errorMessage,
  addRow,
  startEditing,
  cancelEditing,
  saveEditing,
  deleteRow,
} = useLabelledRowsPage(props.endpoint, props.fieldName)
</script>
