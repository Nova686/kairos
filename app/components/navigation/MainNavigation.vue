<template>
  <v-navigation-drawer
    v-model="isDrawerOpen"
    :rail="!isMobile"
    :temporary="isMobile"
  >
    <v-list nav>
      <v-list-item
        v-for="navigationEntry in navigationEntries"
        :key="navigationEntry.path"
        :to="navigationEntry.path"
        :prepend-icon="navigationEntry.icon"
        :title="navigationEntry.label"
      />
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
const isDrawerOpen = defineModel<boolean>({ default: true })
const { navigationEntries, isMobile } = useMainNavigation()
</script>
