<template>
  <div>
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

    <h2 class="text-h6 mb-2">
      À recevoir
    </h2>
    <p v-if="incoming.length === 0">
      Aucun colis en attente de réception.
    </p>
    <v-card
      v-for="incomingDelivery in incoming"
      :key="incomingDelivery.stockItemId"
      class="delivery-list__card"
    >
      <div>
        <div class="text-subtitle-1">
          {{ incomingDelivery.productName }}
        </div>
        <div>Acheté le {{ incomingDelivery.purchasedOn }}</div>
        <TrackingReference :tracking-reference="incomingDelivery.trackingReference" />
      </div>
      <v-btn
        color="primary"
        @click="markReceived(incomingDelivery.stockItemId)"
      >
        Reçu
      </v-btn>
    </v-card>

    <h2 class="text-h6 mt-6 mb-2">
      À livrer
    </h2>
    <p v-if="outgoing.length === 0">
      Aucun colis en cours de livraison.
    </p>
    <v-card
      v-for="outgoingDelivery in outgoing"
      :key="outgoingDelivery.saleId"
      class="delivery-list__card"
    >
      <div>
        <div class="text-subtitle-1">
          {{ outgoingDelivery.productNames.join(', ') }}
        </div>
        <div>Vendu le {{ outgoingDelivery.soldOn }}</div>
        <TrackingReference :tracking-reference="outgoingDelivery.trackingReference" />
      </div>
      <v-btn
        color="primary"
        @click="markDelivered(outgoingDelivery.saleId)"
      >
        Livré
      </v-btn>
    </v-card>
  </div>
</template>

<script setup lang="ts">
const { incoming, outgoing, pending, errorMessage, markReceived, markDelivered } = useDeliveries()
</script>

<style scoped>
.delivery-list__card {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 12px;
}
</style>
