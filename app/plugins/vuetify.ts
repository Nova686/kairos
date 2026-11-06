import { createVuetify } from 'vuetify'
import { fr } from 'vuetify/locale'
import {
  brandAccentColor,
  brandBackgroundColor,
  brandBorderColor,
  brandErrorColor,
  brandPrimaryColor,
  brandSecondaryTextColor,
  brandSuccessColor,
  brandSurfaceColor,
  brandSurfaceVariantColor,
  brandTextColor,
} from '~~/shared/theme/brand-colors'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    locale: { locale: 'fr', fallback: 'fr', messages: { fr } },
    theme: {
      defaultTheme: 'coffre',
      themes: {
        coffre: {
          dark: true,
          colors: {
            'background': brandBackgroundColor,
            'surface': brandSurfaceColor,
            'surface-variant': brandSurfaceVariantColor,
            'on-background': brandTextColor,
            'on-surface': brandTextColor,
            'on-surface-variant': brandSecondaryTextColor,
            'primary': brandPrimaryColor,
            'on-primary': brandBackgroundColor,
            'secondary': brandSecondaryTextColor,
            'accent': brandAccentColor,
            'success': brandSuccessColor,
            'error': brandErrorColor,
          },
          variables: {
            'border-color': brandBorderColor,
            'border-opacity': 1,
          },
        },
      },
    },
    defaults: {
      VCard: { variant: 'flat', border: true },
      VChip: { variant: 'tonal', rounded: 'pill' },
      VBtn: { variant: 'flat', rounded: 'lg' },
      VDataTable: { hover: true },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
