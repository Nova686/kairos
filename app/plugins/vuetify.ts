import { createVuetify } from 'vuetify'
import { fr } from 'vuetify/locale'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    locale: { locale: 'fr', fallback: 'fr', messages: { fr } },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: '#1e5a8a',
            secondary: '#5c6b7a',
            accent: '#c77d1a',
            success: '#2e7d4f',
            error: '#b3372f',
          },
        },
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
