<template>
  <NuxtPwaManifest />
  <v-app>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>

<script setup lang="ts">
import { brandPrimaryColor } from '~~/shared/theme/brand-colors'

useHead({
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Kairos' },
    { name: 'theme-color', content: brandPrimaryColor },
  ],
  link: [{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
})
</script>
