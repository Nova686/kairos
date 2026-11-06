<template>
  <div class="kairos-page">
    <div class="kairos-page-heading">
      <h1 class="kairos-page-title">
        Ventes
      </h1>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
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
