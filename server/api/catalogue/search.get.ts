import { searchProductCandidates } from '../../domain/catalogue/search-product-candidates'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  const { q: searchQuery } = getQuery(event)
  return searchProductCandidates(await useDatabase(), typeof searchQuery === 'string' ? searchQuery : '')
})
