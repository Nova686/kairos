import { readFileSync } from 'node:fs'
import { cardmarketFileUrls } from '../../../src/price-sources/cardmarket/cardmarket-files.ts'
import { parseCardmarketPriceGuide } from '../../../src/price-sources/cardmarket/parse-cardmarket-price-guide.ts'
import { searchCardmarketCatalogue } from '../../../src/price-sources/cardmarket/search-cardmarket-catalogue.ts'
import type { CardmarketCatalogueProduct } from '../../../src/price-sources/cardmarket/search-cardmarket-catalogue.ts'

const readCardmarketFixture = (fixtureName: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../fixtures/cardmarket/${fixtureName}`, import.meta.url), 'utf8'))

const sealedProducts = (readCardmarketFixture('nonsingles-sample.json') as { products: CardmarketCatalogueProduct[] }).products

describe('cardmarketFileUrls', () => {
  it('points at the public Pokémon files', () => {
    expect(cardmarketFileUrls(6)).toEqual({
      priceGuide: 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json',
      singles: 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json',
      nonSingles: 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json',
    })
  })
})

describe('parseCardmarketPriceGuide', () => {
  const aggregatesByProduct = parseCardmarketPriceGuide(readCardmarketFixture('price-guide-sample.json'), '2026-11-02T00:00:00Z')

  it('converts the euro figures of a product into cents', () => {
    expect(aggregatesByProduct.get(798930)).toMatchObject({
      source: 'cardmarket',
      sourceProductId: '798930',
      averageCents: 15123,
      lowCents: 8400,
      trendCents: 14764,
      average7DaysCents: null,
      average30DaysCents: null,
      observedAt: '2026-11-02T00:00:00Z',
    })
  })

  it('skips a product without any price', () => {
    expect(aggregatesByProduct.has(271903)).toBe(false)
  })

  it('never turns a missing figure into a zero price', () => {
    for (const aggregate of aggregatesByProduct.values()) {
      for (const figure of [aggregate.averageCents, aggregate.lowCents, aggregate.trendCents]) {
        expect(figure === null || figure > 0).toBe(true)
      }
    }
  })
})

describe('searchCardmarketCatalogue', () => {
  it('finds the elite trainer box first', () => {
    expect(searchCardmarketCatalogue(sealedProducts, 'prismatic elite trainer', 5)[0]?.idProduct).toBe(798930)
  })

  it('ignores case and accents', () => {
    expect(searchCardmarketCatalogue(sealedProducts, 'PRISMATIC ÉLITE', 5)[0]?.idProduct).toBe(798930)
  })

  it('requires every word of the query', () => {
    expect(searchCardmarketCatalogue(sealedProducts, 'prismatic obsidian', 5)).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchCardmarketCatalogue(sealedProducts, 'prismatic', 3)).toHaveLength(3)
  })
})
