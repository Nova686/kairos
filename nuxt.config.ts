import vuetify from 'vite-plugin-vuetify'
import { brandBackgroundColor } from './shared/theme/brand-colors.ts'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-02',
  modules: ['@nuxt/eslint', 'nuxt-auth-utils', '@vite-pwa/nuxt'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['@mdi/font/css/materialdesignicons.css', 'vuetify/styles', '~/assets/styles/coffre.css'],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap',
        },
      ],
    },
  },
  build: { transpile: ['vuetify'] },
  vite: {
    plugins: [vuetify({ autoImport: true })],
  },
  runtimeConfig: {
    databaseUrl: 'pglite://.data/kairos',
    modelsDirectory: '.data/models',
    tesseractDirectory: '.data/tesseract',
    photoRecognition: 'on',
  },
  nitro: {
    preset: 'node-server',
    experimental: { tasks: true },
    scheduledTasks: {
      '0 4 * * *': ['catalogue:refresh-cardmarket-products'],
      '30 4 * * *': ['prices:enqueue-daily'],
      '*/5 * * * *': ['prices:process-queue'],
      '0 6 * * *': ['valuation:record-stock-value'],
      '*/15 * * * *': ['scan:embed-catalogue-images'],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Kairos',
      short_name: 'Kairos',
      lang: 'fr',
      display: 'standalone',
      start_url: '/',
      theme_color: brandBackgroundColor,
      background_color: brandBackgroundColor,
      icons: [
        { src: '/icons/kairos-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/kairos-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/kairos-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,png,svg,ico}'],
      runtimeCaching: [
        { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly' },
      ],
    },
    client: { installPrompt: false },
    devOptions: { enabled: false },
  },
  typescript: { strict: true },
})
