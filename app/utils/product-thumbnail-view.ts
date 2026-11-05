import { safeExternalHref } from './safe-external-href.ts'

export interface ProductThumbnailView {
  imageSource: string | null
  glyph: string
  hasHoloBorder: boolean
}

const glyphsByCategory: Record<string, string> = {
  'pokemon-sealed': 'mdi-package-variant-closed',
  'graded-card': 'mdi-card-text-outline',
  'toy': 'mdi-teddy-bear',
  'makeup': 'mdi-lipstick',
  'other': 'mdi-cube-outline',
}

const fallbackGlyph = 'mdi-cube-outline'

export const describeProductThumbnail = (category: string, imageUrl: string | null): ProductThumbnailView => ({
  imageSource: safeExternalHref(imageUrl) ?? null,
  glyph: glyphsByCategory[category] ?? fallbackGlyph,
  hasHoloBorder: category === 'graded-card',
})
