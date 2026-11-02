<template>
  <v-alert
    v-if="isInvitationUnavailable"
    type="error"
  >
    Cette invitation est invalide, déjà utilisée ou expirée.
  </v-alert>
  <v-card v-else>
    <v-card-title>Créer votre compte</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="submitAcceptance">
        <v-text-field
          v-model="displayName"
          label="Nom affiché"
          autocomplete="name"
          required
        />
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          required
        />
        <v-text-field
          v-model="password"
          label="Mot de passe (10 caractères minimum)"
          type="password"
          autocomplete="new-password"
          required
        />
        <v-alert
          v-if="errorMessage"
          type="error"
          class="mb-4"
        >
          {{ errorMessage }}
        </v-alert>
        <v-btn
          type="submit"
          color="primary"
          block
          :loading="isSubmitting"
        >
          Créer mon compte
        </v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'centered' })

const route = useRoute()
const { email, displayName, password, errorMessage, isSubmitting, isInvitationUnavailable, submitAcceptance }
  = useInvitationAcceptance(String(route.params.code))
</script>
