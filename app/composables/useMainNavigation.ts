import { useDisplay } from 'vuetify'

export interface NavigationEntry {
  label: string
  path: string
  icon: string
}

const navigationEntries: NavigationEntry[] = [
  { label: 'Tableau de bord', path: '/', icon: 'mdi-view-dashboard' },
  { label: 'Stock', path: '/stock', icon: 'mdi-package-variant' },
  { label: 'Ajouter', path: '/ajouter', icon: 'mdi-plus-box' },
  { label: 'Ventes', path: '/ventes', icon: 'mdi-cash-multiple' },
  { label: 'Livraisons', path: '/livraisons', icon: 'mdi-truck-delivery' },
  { label: 'Dettes', path: '/dettes', icon: 'mdi-account-cash' },
  { label: 'Lieux', path: '/lieux', icon: 'mdi-map-marker' },
  { label: 'Personnes', path: '/personnes', icon: 'mdi-account-group' },
  { label: 'Réglages', path: '/reglages', icon: 'mdi-cog' },
]

export const useMainNavigation = () => {
  const { mobile: isMobile } = useDisplay()

  return { navigationEntries, isMobile }
}
