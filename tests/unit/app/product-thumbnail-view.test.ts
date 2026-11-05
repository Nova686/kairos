import { describe, expect, it } from 'vitest'
import { describeProductThumbnail } from '../../../app/utils/product-thumbnail-view.ts'

describe('describeProductThumbnail', () => {
  it('uses the product image when its link is safe', () => {
    expect(describeProductThumbnail('toy', 'https://images.example.org/a.jpg').imageSource).toBe('https://images.example.org/a.jpg')
  })

  it('falls back to the category glyph when the image is missing or unsafe', () => {
    expect(describeProductThumbnail('toy', null)).toMatchObject({ imageSource: null, glyph: 'mdi-teddy-bear' })
    expect(describeProductThumbnail('toy', 'javascript:alert(1)').imageSource).toBeNull()
  })

  it.each([
    ['pokemon-sealed', 'mdi-package-variant-closed'],
    ['graded-card', 'mdi-card-text-outline'],
    ['toy', 'mdi-teddy-bear'],
    ['makeup', 'mdi-lipstick'],
    ['other', 'mdi-cube-outline'],
    ['something-else', 'mdi-cube-outline'],
  ])('shows %s as %s', (category, glyph) => {
    expect(describeProductThumbnail(category, null).glyph).toBe(glyph)
  })

  it('gives the holographic border to graded cards only', () => {
    expect(describeProductThumbnail('graded-card', null).hasHoloBorder).toBe(true)
    expect(describeProductThumbnail('pokemon-sealed', null).hasHoloBorder).toBe(false)
  })
})
