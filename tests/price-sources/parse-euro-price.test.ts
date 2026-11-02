import { parseEuroPrice } from '../../src/price-sources/parse-euro-price.ts'
import { deduplicateByUrl } from '../../src/price-sources/price-source-types.ts'
import type { ListingObservation } from '../../src/price-sources/price-source-types.ts'

describe('parseEuroPrice', () => {
  it.each([
    ['12 €', 1200],
    ['12,00 €', 1200],
    ['1 234,56 €', 123456],
    ['1 234,56 €', 123456],
    ['EUR 12,00', 1200],
    ['10,00 € à 15,00 €', 1000],
  ])('parses %s', (displayedPrice, expectedCents) => {
    expect(parseEuroPrice(displayedPrice)).toBe(expectedCents)
  })

  it.each(['Prix sur demande', '$12.00', '12,00 £', '', 'Gratuit'])('rejects %s', (displayedPrice) => {
    expect(parseEuroPrice(displayedPrice)).toBeNull()
  })
})

describe('deduplicateByUrl', () => {
  it('keeps one observation per url', () => {
    const observation: ListingObservation = {
      source: 'ebay',
      kind: 'active',
      title: 'ETB',
      priceCents: 5000,
      shippingCents: null,
      sourceCondition: null,
      url: 'https://www.ebay.fr/itm/1',
      imageUrl: null,
    }
    const kept = deduplicateByUrl([observation, { ...observation, priceCents: 4000 }])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.priceCents).toBe(5000)
  })
})
