import { createVuetify } from 'vuetify'
import { fr } from 'vuetify/locale'
import { brandAccentColor, brandPrimaryColor } from '~~/shared/theme/brand-colors'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    locale: { locale: 'fr', fallback: 'fr', messages: { fr } },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: brandPrimaryColor,
            secondary: '#5c6b7a',
            accent: brandAccentColor,
            success: '#2e7d4f',
            error: '#b3372f',
          },
        },
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
