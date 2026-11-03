<template>
  <NuxtPwaManifest />
  <v-app>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>

<script setup lang="ts">
useHead({
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Kairos' },
    { name: 'theme-color', content: '#1e5a8a' },
  ],
  link: [{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
})
</script>
