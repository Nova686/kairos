import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-02',
  modules: ['@nuxt/eslint', 'nuxt-auth-utils'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['@mdi/font/css/materialdesignicons.css', 'vuetify/styles'],
  build: { transpile: ['vuetify'] },
  vite: {
    plugins: [vuetify({ autoImport: true })],
  },
  runtimeConfig: {
    databaseUrl: 'pglite://.data/kairos',
    modelsDirectory: '.data/models',
  },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      '0 4 * * *': ['catalogue:refresh-cardmarket-products'],
      '30 4 * * *': ['prices:enqueue-daily'],
      '*/5 * * * *': ['prices:process-queue'],
      '0 6 * * *': ['valuation:record-stock-value'],
      '*/15 * * * *': ['scan:embed-catalogue-images'],
    },
  },
  typescript: { strict: true },
})
