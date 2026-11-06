import type { ProductDraft } from './product-draft.ts'

export interface ProductCandidate {
  origin: 'catalogue' | 'cardmarket' | 'tcgdex' | 'ebay' | 'identification'
  label: string
  imageUrl: string | null
  productId: string | null
  draft: ProductDraft
}
