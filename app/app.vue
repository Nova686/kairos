<template>
  <NuxtPwaManifest />
  <v-app>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>

<script setup lang="ts">
import { brandBackgroundColor } from '~~/shared/theme/brand-colors'

useHead({
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Kairos' },
    { name: 'theme-color', content: brandBackgroundColor },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icons/kairos.svg' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  ],
})
</script>
