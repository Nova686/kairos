import { describe, expect, it } from 'vitest'
import { productCandidateKey } from '../../../app/utils/product-candidate-key.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { ProductCandidate } from '../../../shared/catalogue/product-candidate.ts'

const candidate = (overrides: Partial<ProductCandidate>): ProductCandidate => ({
  origin: 'cardmarket',
  label: 'Booster Display',
  imageUrl: null,
  productId: null,
  draft: emptyProductDraft('Booster Display', 'pokemon-sealed'),
  ...overrides,
})

describe('productCandidateKey', () => {
  it('tells apart two candidates of one origin sharing a label', () => {
    const firstDisplay = candidate({ draft: { ...emptyProductDraft('Booster Display', 'pokemon-sealed'), cardmarketProductId: 101 } })
    const secondDisplay = candidate({ draft: { ...emptyProductDraft('Booster Display', 'pokemon-sealed'), cardmarketProductId: 202 } })
    const firstCatalogueProduct = candidate({ origin: 'catalogue', productId: 'product-1' })
    const secondCatalogueProduct = candidate({ origin: 'catalogue', productId: 'product-2' })

    expect(productCandidateKey(firstDisplay)).not.toBe(productCandidateKey(secondDisplay))
    expect(productCandidateKey(firstCatalogueProduct)).not.toBe(productCandidateKey(secondCatalogueProduct))
  })

  it('falls back to the label for a candidate without any identifier', () => {
    expect(productCandidateKey(candidate({ origin: 'ebay', label: 'ETB Zygarde' }))).toBe('ebay|ETB Zygarde')
  })
})
