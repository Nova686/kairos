<template>
  <v-card class="kairos-auth__card">
    <h1 class="kairos-panel__title">
      Connexion
    </h1>
    <div>
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
    </div>
  </v-card>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'centered' })

const { email, password, errorMessage, isSubmitting, submitLogin } = useLoginForm()
</script>
