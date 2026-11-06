export const useEbaySearchSettings = (
  readEbayQuery: () => string | null,
  readExcludedKeywords: () => string[],
  saveEbaySettings: (ebayQuery: string | null, ebayExcludedKeywords: string[]) => Promise<boolean>,
) => {
  const ebayQuery = ref(readEbayQuery() ?? '')
  const excludedKeywords = ref<string[]>([...readExcludedKeywords()])
  const savedMessage = ref('')

  const submitEbaySettings = async () => {
    const trimmedQuery = ebayQuery.value.trim()
    const cleanedKeywords = excludedKeywords.value.map(keyword => keyword.trim()).filter(keyword => keyword !== '')
    const isSaved = await saveEbaySettings(trimmedQuery === '' ? null : trimmedQuery, cleanedKeywords)
    savedMessage.value = isSaved ? 'Réglages enregistrés.' : ''
  }

  return { ebayQuery, excludedKeywords, savedMessage, submitEbaySettings }
}
