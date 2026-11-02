<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5">
        Ventes
      </h1>
      <v-btn
        color="primary"
        to="/ventes/nouvelle"
      >
        Nouvelle vente
      </v-btn>
    </div>
    <v-progress-linear
      v-if="pending"
      indeterminate
    />
    <SaleList :sales="sales" />
  </div>
</template>

<script setup lang="ts">
const { sales, pending } = useSales()
</script>
