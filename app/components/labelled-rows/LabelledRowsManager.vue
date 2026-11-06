<template>
  <div class="kairos-page">
    <h1 class="kairos-page-title">
      {{ title }}
    </h1>
    <v-form
      class="d-flex ga-2"
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
      class="kairos-empty"
    >
      {{ emptyMessage }}
    </p>
    <v-card
      v-else
      class="kairos-panel"
    >
      <v-list
        bg-color="transparent"
        class="pa-0"
      >
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
    </v-card>
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
