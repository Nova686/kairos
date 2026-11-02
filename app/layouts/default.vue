<template>
  <div>
    <MainNavigation v-model="isDrawerOpen" />
    <v-app-bar
      color="primary"
      flat
    >
      <v-app-bar-nav-icon
        aria-label="Ouvrir la navigation"
        @click="isDrawerOpen = !isDrawerOpen"
      />
      <v-app-bar-title>Kairos</v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-container>
        <slot />
      </v-container>
    </v-main>
  </div>
</template>

<script setup lang="ts">
const isDrawerOpen = ref(true)
</script>
