<template>
  <div class="kairos-page">
    <h1 class="kairos-page-title">
      Réglages
    </h1>
    <v-card
      v-if="user?.isAdmin"
      class="kairos-panel"
    >
      <h2 class="kairos-panel__title">
        Inviter quelqu'un
      </h2>
      <div>
        <v-btn
          color="primary"
          :loading="isCreating"
          @click="createInvitationLink"
        >
          Créer une invitation
        </v-btn>
        <v-alert
          v-if="errorMessage"
          type="error"
          class="mt-4"
        >
          {{ errorMessage }}
        </v-alert>
        <v-text-field
          v-if="invitationLink"
          :model-value="invitationLink"
          label="Lien d'invitation (valable 7 jours)"
          readonly
          class="mt-4"
        >
          <template #append-inner>
            <v-btn
              icon="mdi-content-copy"
              variant="text"
              aria-label="Copier le lien d'invitation"
              @click="copyInvitationLink"
            />
          </template>
        </v-text-field>
        <p
          v-if="hasCopiedLink"
          role="status"
        >
          Lien copié.
        </p>
      </div>
    </v-card>
    <div class="d-flex flex-wrap ga-2">
      <v-btn
        variant="outlined"
        prepend-icon="mdi-swap-horizontal"
        to="/reglages/correspondances"
      >
        Correspondances d'états
      </v-btn>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-logout"
        @click="signOut"
      >
        Se déconnecter
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user } = useUserSession()
const { signOut } = useSignOut()
const { invitationLink, errorMessage, hasCopiedLink, isCreating, createInvitationLink, copyInvitationLink }
  = useInvitationCreation()
</script>
