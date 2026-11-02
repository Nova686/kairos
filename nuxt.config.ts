import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-02',
  modules: ['@nuxt/eslint'],
  components: [{ path: '~/components', pathPrefix: false }],
  css: ['@mdi/font/css/materialdesignicons.css', 'vuetify/styles'],
  build: { transpile: ['vuetify'] },
  vite: {
    plugins: [vuetify({ autoImport: true })],
  },
  runtimeConfig: {
    databaseUrl: 'pglite://.data/kairos',
  },
  typescript: { strict: true },
})
