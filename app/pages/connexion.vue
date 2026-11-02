<template>
  <v-card>
    <v-card-title>Connexion</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="submitLogin">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          required
        />
        <v-text-field
          v-model="password"
          label="Mot de passe"
          type="password"
          autocomplete="current-password"
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
          Se connecter
        </v-btn>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'centered' })

const { email, password, errorMessage, isSubmitting, submitLogin } = useLoginForm()
</script>
