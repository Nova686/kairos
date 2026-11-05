export interface NavigationEntry {
  label: string
  shortLabel: string
  path: string
  icon: string
  placement: 'bottom-bar' | 'more-menu'
}

export const mainNavigationEntries: NavigationEntry[] = [
  { label: 'Tableau de bord', shortLabel: 'Accueil', path: '/', icon: 'mdi-view-dashboard-outline', placement: 'bottom-bar' },
  { label: 'Stock', shortLabel: 'Stock', path: '/stock', icon: 'mdi-archive-outline', placement: 'bottom-bar' },
  { label: 'Ajouter', shortLabel: 'Ajouter', path: '/ajouter', icon: 'mdi-plus-box-outline', placement: 'bottom-bar' },
  { label: 'Ventes', shortLabel: 'Ventes', path: '/ventes', icon: 'mdi-cash-multiple', placement: 'bottom-bar' },
  { label: 'Livraisons', shortLabel: 'Livraisons', path: '/livraisons', icon: 'mdi-truck-outline', placement: 'more-menu' },
  { label: 'Dettes', shortLabel: 'Dettes', path: '/dettes', icon: 'mdi-wallet-outline', placement: 'more-menu' },
  { label: 'Lieux', shortLabel: 'Lieux', path: '/lieux', icon: 'mdi-map-marker-outline', placement: 'more-menu' },
  { label: 'Personnes', shortLabel: 'Personnes', path: '/personnes', icon: 'mdi-account-group-outline', placement: 'more-menu' },
  { label: 'Réglages', shortLabel: 'Réglages', path: '/reglages', icon: 'mdi-cog-outline', placement: 'more-menu' },
]

export const bottomBarEntries: NavigationEntry[] = mainNavigationEntries.filter(entry => entry.placement === 'bottom-bar')

export const moreMenuEntries: NavigationEntry[] = mainNavigationEntries.filter(entry => entry.placement === 'more-menu')

const entryRootsByAlias: Record<string, string> = { '/produits': '/stock' }

export const isNavigationEntryActive = (entryPath: string, currentPath: string): boolean => {
  if (entryPath === '/') {
    return currentPath === '/'
  }
  const currentRoot = `/${currentPath.split('/')[1] ?? ''}`
  const resolvedRoot = entryRootsByAlias[currentRoot] ?? currentRoot
  return resolvedRoot === entryPath
}
