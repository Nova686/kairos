export const resolveAddProductTab = (queryValue: unknown): AddProductTab =>
  addProductTabs.find(tab => tab === queryValue) ?? 'texte'

export const useAddProductTabs = () => {
  const route = useRoute()
  const router = useRouter()

  const activeTab = computed<AddProductTab>({
    get: () => resolveAddProductTab(route.query.onglet),
    set: (selectedTab) => {
      router.replace({ query: { ...route.query, onglet: selectedTab } })
    },
  })

  return { activeTab }
}
