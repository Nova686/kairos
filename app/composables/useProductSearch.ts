import type { ProductCandidate } from '~~/server/domain/catalogue/search-product-candidates'

export interface CandidateGroup {
  origin: ProductCandidate['origin']
  title: string
  candidates: ProductCandidate[]
}

const searchDebounceMilliseconds = 400

const originTitles: Record<ProductCandidate['origin'], string> = {
  catalogue: 'Catalogue',
  cardmarket: 'Cardmarket',
  tcgdex: 'TCGdex',
  ebay: 'eBay',
  identification: 'Code-barres',
}

const unavailableSourceMessages: Record<string, string> = {
  ebay: 'eBay indisponible : clés manquantes',
  tcgdex: 'TCGdex indisponible',
}

const describeUnavailableSource = (sourceName: string): string =>
  unavailableSourceMessages[sourceName] ?? `${sourceName} indisponible`

export const useProductSearch = () => {
  const searchText = ref('')
  const candidates = ref<ProductCandidate[]>([])
  const unavailableSources = ref<string[]>([])
  const isSearching = ref(false)
  const searchErrorMessage = ref('')
  let latestSearchNumber = 0
  let pendingSearch: ReturnType<typeof setTimeout> | undefined

  const candidateGroups = computed<CandidateGroup[]>(() =>
    (Object.keys(originTitles) as ProductCandidate['origin'][])
      .map(origin => ({
        origin,
        title: originTitles[origin],
        candidates: candidates.value.filter(candidate => candidate.origin === origin),
      }))
      .filter(group => group.candidates.length > 0),
  )

  const unavailableMessages = computed(() => unavailableSources.value.map(describeUnavailableSource))

  const runSearch = async () => {
    latestSearchNumber += 1
    const searchNumber = latestSearchNumber
    const trimmedText = searchText.value.trim()
    searchErrorMessage.value = ''
    if (trimmedText === '') {
      candidates.value = []
      unavailableSources.value = []
      isSearching.value = false
      return
    }
    isSearching.value = true
    try {
      const outcome = await $fetch<{ candidates: ProductCandidate[], unavailableSources: string[] }>(
        '/api/catalogue/search',
        { query: { q: trimmedText } },
      )
      if (searchNumber === latestSearchNumber) {
        candidates.value = outcome.candidates
        unavailableSources.value = outcome.unavailableSources
      }
    }
    catch {
      if (searchNumber === latestSearchNumber) {
        searchErrorMessage.value = 'La recherche a échoué. Réessayez.'
      }
    }
    finally {
      if (searchNumber === latestSearchNumber) {
        isSearching.value = false
      }
    }
  }

  watch(searchText, () => {
    clearTimeout(pendingSearch)
    pendingSearch = setTimeout(runSearch, searchDebounceMilliseconds)
  })

  onScopeDispose(() => clearTimeout(pendingSearch))

  return { searchText, candidateGroups, unavailableMessages, isSearching, searchErrorMessage, runSearch }
}
