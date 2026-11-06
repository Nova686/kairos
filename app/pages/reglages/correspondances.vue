<template>
  <div class="kairos-page">
    <h1 class="kairos-page-title">
      Correspondances d'états
    </h1>
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

    <v-card class="kairos-panel">
    <h2 class="kairos-panel__title">
      États des sources
    </h2>
    <v-form
      class="d-flex flex-wrap ga-2 mb-4"
      @submit.prevent="addMapping"
    >
      <v-select
        v-model="newMapping.category"
        :items="categoryOptions"
        label="Catégorie"
        hide-details
      />
      <v-text-field
        v-model="newMapping.source"
        label="Source"
        hide-details
      />
      <v-text-field
        v-model="newMapping.sourceCondition"
        label="État de la source"
        hide-details
      />
      <v-select
        v-model="newMapping.kairosCondition"
        :items="conditionOptionsFor(newMapping.category)"
        label="État Kairos"
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
    <p
      v-if="!pending && mappings.length === 0"
      class="kairos-empty"
    >
      Aucune correspondance.
    </p>
    <v-list
      v-else
      bg-color="transparent"
      class="pa-0"
    >
      <v-list-item
        v-for="mapping in mappings"
        :key="`${mapping.category}/${mapping.source}/${mapping.sourceCondition}`"
        :title="`${categoryLabel(mapping.category)} · ${mapping.source} · ${mapping.sourceCondition}`"
      >
        <template #append>
          <v-select
            :model-value="mapping.kairosCondition"
            :items="conditionOptionsFor(mapping.category)"
            :aria-label="`État Kairos de ${mapping.sourceCondition}`"
            density="compact"
            hide-details
            @update:model-value="changeMappingCondition(mapping, $event)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            :aria-label="`Supprimer la correspondance ${mapping.sourceCondition}`"
            @click="deleteMapping(mapping)"
          />
        </template>
      </v-list-item>
    </v-list>

    </v-card>

    <v-card class="kairos-panel">
    <h2 class="kairos-panel__title">
      Règles sur le titre
    </h2>
    <p class="text-body-2 text-medium-emphasis mb-2">
      Un mot-clé reconnaît un mot entier du titre, sans tenir compte des majuscules ni des accents.
      Terminez-le par * pour reconnaître tous les mots qui commencent ainsi : abîm* trouve « abîmée ».
      Un mot-clé précédé de non, jamais, pas, never ou not est ignoré : « jamais ouvert » ne compte pas comme ouvert.
    </p>
    <v-form
      class="d-flex flex-wrap ga-2 mb-4"
      @submit.prevent="addRule"
    >
      <v-select
        v-model="newRule.category"
        :items="categoryOptions"
        label="Catégorie"
        hide-details
      />
      <v-combobox
        v-model="newRule.keywords"
        label="Mots-clés"
        multiple
        chips
        closable-chips
        hide-details
      />
      <v-select
        v-model="newRule.kairosCondition"
        :items="conditionOptionsFor(newRule.category)"
        label="État Kairos"
        hide-details
      />
      <v-text-field
        v-model.number="newRule.priority"
        label="Priorité"
        type="number"
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
    <p
      v-if="!pending && rules.length === 0"
      class="kairos-empty"
    >
      Aucune règle.
    </p>
    <v-list
      v-else
      bg-color="transparent"
      class="pa-0"
    >
      <v-list-item
        v-for="rule in rules"
        :key="rule.id"
      >
        <v-form
          v-if="editedRule && editedRule.id === rule.id"
          class="d-flex flex-wrap ga-2"
          @submit.prevent="saveEditedRule"
        >
          <v-combobox
            v-model="editedRule.keywords"
            label="Mots-clés"
            multiple
            chips
            closable-chips
            density="compact"
            hide-details
          />
          <v-select
            v-model="editedRule.kairosCondition"
            :items="conditionOptionsFor(editedRule.category)"
            label="État Kairos"
            density="compact"
            hide-details
          />
          <v-text-field
            v-model.number="editedRule.priority"
            label="Priorité"
            type="number"
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
            @click="cancelEditingRule"
          >
            Annuler
          </v-btn>
        </v-form>
        <template v-else>
          <v-list-item-title>{{ categoryLabel(rule.category) }} · {{ rule.keywords.join(', ') }}</v-list-item-title>
          <v-list-item-subtitle>{{ kairosConditionLabel(rule.kairosCondition) }} · priorité {{ rule.priority }}</v-list-item-subtitle>
        </template>
        <template
          v-if="!editedRule || editedRule.id !== rule.id"
          #append
        >
          <v-btn
            icon="mdi-pencil"
            variant="text"
            :aria-label="`Modifier la règle ${rule.keywords.join(', ')}`"
            @click="startEditingRule(rule)"
          />
          <v-btn
            icon="mdi-delete"
            variant="text"
            :aria-label="`Supprimer la règle ${rule.keywords.join(', ')}`"
            @click="deleteRule(rule)"
          />
        </template>
      </v-list-item>
    </v-list>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const {
  mappings,
  rules,
  pending,
  errorMessage,
  newMapping,
  newRule,
  editedRule,
  categoryOptions,
  conditionOptionsFor,
  categoryLabel,
  kairosConditionLabel,
  addMapping,
  changeMappingCondition,
  deleteMapping,
  addRule,
  startEditingRule,
  cancelEditingRule,
  saveEditedRule,
  deleteRule,
} = useConditionMappingsPage()
</script>
