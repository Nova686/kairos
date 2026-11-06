<template>
  <div class="delivery-list">
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

    <h2 class="kairos-label">
      À recevoir
    </h2>
    <p
      v-if="incoming.length === 0"
      class="kairos-empty"
    >
      Aucun colis en attente de réception.
    </p>
    <v-card
      v-for="incomingDelivery in incoming"
      :key="incomingDelivery.stockItemId"
      class="kairos-row-card"
    >
      <div>
        <div class="kairos-row-card__title">
          {{ incomingDelivery.productName }}
        </div>
        <div class="kairos-row-card__detail">
          Acheté le {{ incomingDelivery.purchasedOn }}
        </div>
        <TrackingReference :tracking-reference="incomingDelivery.trackingReference" />
      </div>
      <v-btn
        color="primary"
        :loading="isActionPending(incomingDelivery.stockItemId)"
        @click="markReceived(incomingDelivery.stockItemId)"
      >
        Reçu
      </v-btn>
    </v-card>

    <h2 class="kairos-label delivery-list__section">
      À livrer
    </h2>
    <p
      v-if="outgoing.length === 0"
      class="kairos-empty"
    >
      Aucun colis en cours de livraison.
    </p>
    <v-card
      v-for="outgoingDelivery in outgoing"
      :key="outgoingDelivery.saleId"
      class="kairos-row-card"
    >
      <div>
        <div class="kairos-row-card__title">
          {{ outgoingDelivery.productNames.join(', ') }}
        </div>
        <div class="kairos-row-card__detail">
          Vendu le {{ outgoingDelivery.soldOn }}
        </div>
        <TrackingReference :tracking-reference="outgoingDelivery.trackingReference" />
      </div>
      <v-btn
        color="primary"
        :loading="isActionPending(outgoingDelivery.saleId)"
        @click="markDelivered(outgoingDelivery.saleId)"
      >
        Livré
      </v-btn>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const { incoming, outgoing, pending, errorMessage, isActionPending, markReceived, markDelivered } = useDeliveries()
</script>

<style scoped>
.delivery-list {
  display: grid;
  gap: 12px;
}

.delivery-list__section {
  margin-top: 8px;
}
</style>
