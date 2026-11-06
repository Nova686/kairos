import type { ProductCandidate } from '~~/shared/catalogue/product-candidate.ts'

export const productCandidateKey = (candidate: ProductCandidate): string => {
  const identifier = candidate.productId
    ?? candidate.draft.cardmarketProductId
    ?? candidate.draft.tcgdexCardId
    ?? candidate.label
  return `${candidate.origin}|${identifier}`
}
