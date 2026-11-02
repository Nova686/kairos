<template>
  <v-main>
    <v-container class="centered-layout__container">
      <h1 class="text-h4 text-center mb-6">
        Kairos
      </h1>
      <slot />
    </v-container>
  </v-main>
</template>

<style scoped>
.centered-layout__container {
  max-width: 28rem;
}
</style>
