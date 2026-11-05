export const resolveAddProductTab = (queryValue: unknown): AddProductTab | null =>
  addProductTabs.find(tab => tab === queryValue) ?? null

export const useAddProductTabs = () => {
  const route = useRoute()
  const router = useRouter()

  const activeTab = computed<AddProductTab | null>({
    get: () => resolveAddProductTab(route.query.onglet),
    set: (selectedTab) => {
      router.replace({ query: { ...route.query, onglet: selectedTab } })
    },
  })

  return { activeTab }
}
