<template>
  <div>
    <h1 class="text-h5 mb-4">
      Réglages
    </h1>
    <v-card
      v-if="user?.isAdmin"
      class="mb-4"
    >
      <v-card-title>Inviter quelqu'un</v-card-title>
      <v-card-text>
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
      </v-card-text>
    </v-card>
    <v-btn
      variant="outlined"
      class="mr-2"
      to="/reglages/correspondances"
    >
      Correspondances d'états
    </v-btn>
    <v-btn
      variant="outlined"
      @click="signOut"
    >
      Se déconnecter
    </v-btn>
  </div>
</template>

<script setup lang="ts">
const { user } = useUserSession()
const { signOut } = useSignOut()
const { invitationLink, errorMessage, hasCopiedLink, isCreating, createInvitationLink, copyInvitationLink }
  = useInvitationCreation()
</script>
