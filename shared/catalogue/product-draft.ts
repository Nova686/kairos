import type { ProductCategory } from './product-category.ts'

export interface ProductDraft {
  name: string
  category: ProductCategory
  productType: string | null
  seriesName: string | null
  language: string | null
  imageUrl: string | null
  cardmarketProductId: number | null
  tcgdexCardId: string | null
  pokemontcgCardId: string | null
  ebayQuery: string | null
  ebayExcludedKeywords: string[]
}

export const productDraftFieldNames = [
  'name',
  'category',
  'productType',
  'seriesName',
  'language',
  'imageUrl',
  'cardmarketProductId',
  'tcgdexCardId',
  'pokemontcgCardId',
  'ebayQuery',
  'ebayExcludedKeywords',
] as const satisfies readonly (keyof ProductDraft)[]

export const emptyProductDraft = (name: string, category: ProductCategory): ProductDraft => ({
  name,
  category,
  productType: null,
  seriesName: null,
  language: null,
  imageUrl: null,
  cardmarketProductId: null,
  tcgdexCardId: null,
  pokemontcgCardId: null,
  ebayQuery: null,
  ebayExcludedKeywords: [],
})
