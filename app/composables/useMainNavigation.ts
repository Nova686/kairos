export const useMainNavigation = () => {
  const route = useRoute()

  const isEntryActive = (entry: NavigationEntry): boolean => isNavigationEntryActive(entry.path, route.path)

  const isMoreMenuActive = computed(() => moreMenuEntries.some(isEntryActive))

  return { mainNavigationEntries, bottomBarEntries, moreMenuEntries, isEntryActive, isMoreMenuActive }
}
