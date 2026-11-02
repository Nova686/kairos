import { inArray, or } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { cardmarketProducts, products } from '../../database/schema/index.ts'
import { emptyProductDraft, type ProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { isProductCategory } from '../../../shared/catalogue/product-category.ts'
import { searchCardmarketCatalogue } from '../../../src/price-sources/cardmarket/search-cardmarket-catalogue.ts'
import { searchEbayListings } from '../../../src/price-sources/ebay/ebay-adapter.ts'
import type { CardCandidate } from '../../../src/price-sources/card-candidate.ts'
import {
  SourceBlockedError,
  SourceDisabledError,
  type ListingObservation,
} from '../../../src/price-sources/price-source-types.ts'
import { searchTcgdexCards } from '../../../src/price-sources/tcgdex/tcgdex-adapter.ts'
import type { Product } from './catalogue-service.ts'

export interface ProductCandidate {
  origin: 'catalogue' | 'cardmarket' | 'tcgdex' | 'ebay'
  label: string
  imageUrl: string | null
  productId: string | null
  draft: ProductDraft
}

export interface ProductSearchDependencies {
  searchTcgdexCards: (frenchName: string) => Promise<CardCandidate[]>
  searchEbayListings: (query: string) => Promise<ListingObservation[]>
}

export interface ProductSearchOutcome {
  candidates: ProductCandidate[]
  unavailableSources: string[]
}

const maximumCandidatesPerOrigin = 10

const defaultDependencies: ProductSearchDependencies = {
  searchTcgdexCards: frenchName => searchTcgdexCards(frenchName),
  searchEbayListings: query => searchEbayListings(query),
}

const toSearchableText = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const splitIntoSearchableWords = (query: string): string[] =>
  toSearchableText(query).split(/\s+/).filter(queryWord => queryWord.length > 0)

const toDraft = (product: Product): ProductDraft => ({
  name: product.name,
  category: isProductCategory(product.category) ? product.category : 'other',
  productType: product.productType,
  seriesName: product.seriesName,
  language: product.language,
  imageUrl: product.imageUrl,
  cardmarketProductId: product.cardmarketProductId,
  tcgdexCardId: product.tcgdexCardId,
  pokemontcgCardId: product.pokemontcgCardId,
  ebayQuery: product.ebayQuery,
  ebayExcludedKeywords: product.ebayExcludedKeywords,
})

const toCatalogueCandidate = (product: Product): ProductCandidate => ({
  origin: 'catalogue',
  label: product.name,
  imageUrl: product.imageUrl,
  productId: product.id,
  draft: toDraft(product),
})

const settleSource = async <TOutcome>(
  sourceName: string,
  search: () => Promise<TOutcome[]>,
  unavailableSources: string[],
): Promise<TOutcome[]> => {
  try {
    return await search()
  } catch (failure) {
    if (failure instanceof SourceDisabledError || failure instanceof SourceBlockedError) {
      unavailableSources.push(sourceName)
      return []
    }
    throw failure
  }
}

export const searchProductCandidates = async (
  database: KairosDatabase,
  query: string,
  dependencies: ProductSearchDependencies = defaultDependencies,
): Promise<ProductSearchOutcome> => {
  const trimmedQuery = query.trim()
  const queryWords = splitIntoSearchableWords(trimmedQuery)
  if (queryWords.length === 0) {
    return { candidates: [], unavailableSources: [] }
  }

  const unavailableSources: string[] = []
  const [tcgdexCards, ebayListings, allCardmarketProducts] = await Promise.all([
    settleSource('tcgdex', () => dependencies.searchTcgdexCards(trimmedQuery), unavailableSources),
    settleSource('ebay', () => dependencies.searchEbayListings(trimmedQuery), unavailableSources),
    database.select().from(cardmarketProducts),
  ])
  unavailableSources.sort()

  const matchingCardmarketProducts = searchCardmarketCatalogue(
    allCardmarketProducts,
    trimmedQuery,
    allCardmarketProducts.length,
  )
  const externalCardmarketIds = matchingCardmarketProducts.map(cardmarketProduct => cardmarketProduct.idProduct)
  const externalTcgdexIds = tcgdexCards.map(tcgdexCard => tcgdexCard.sourceCardId)

  const catalogueProducts = await database.select().from(products)
  const linkedProductCondition = or(
    externalCardmarketIds.length > 0 ? inArray(products.cardmarketProductId, externalCardmarketIds) : undefined,
    externalTcgdexIds.length > 0 ? inArray(products.tcgdexCardId, externalTcgdexIds) : undefined,
  )
  const linkedCatalogueProducts = linkedProductCondition
    ? await database.select().from(products).where(linkedProductCondition)
    : []
  const nameMatchingProducts = catalogueProducts.filter((product) => {
    const searchableName = toSearchableText(product.name)
    return queryWords.every(queryWord => searchableName.includes(queryWord))
  })
  const catalogueProductsToShow = [...nameMatchingProducts, ...linkedCatalogueProducts].filter(
    (product, position, shownProducts) =>
      shownProducts.findIndex(otherProduct => otherProduct.id === product.id) === position,
  )

  const knownCardmarketIds = new Set(catalogueProducts.map(product => product.cardmarketProductId))
  const knownTcgdexIds = new Set(catalogueProducts.map(product => product.tcgdexCardId))

  const cardmarketCandidates: ProductCandidate[] = matchingCardmarketProducts
    .filter(cardmarketProduct => !knownCardmarketIds.has(cardmarketProduct.idProduct))
    .slice(0, maximumCandidatesPerOrigin)
    .map(cardmarketProduct => ({
      origin: 'cardmarket',
      label: cardmarketProduct.name,
      imageUrl: null,
      productId: null,
      draft: { ...emptyProductDraft(cardmarketProduct.name, 'pokemon-sealed'), cardmarketProductId: cardmarketProduct.idProduct },
    }))

  const tcgdexCandidates: ProductCandidate[] = tcgdexCards
    .filter(tcgdexCard => !knownTcgdexIds.has(tcgdexCard.sourceCardId))
    .slice(0, maximumCandidatesPerOrigin)
    .map(tcgdexCard => ({
      origin: 'tcgdex',
      label: tcgdexCard.setName ? `${tcgdexCard.name} (${tcgdexCard.setName})` : tcgdexCard.name,
      imageUrl: tcgdexCard.imageUrl,
      productId: null,
      draft: {
        ...emptyProductDraft(tcgdexCard.name, 'graded-card'),
        seriesName: tcgdexCard.setName,
        imageUrl: tcgdexCard.imageUrl,
        tcgdexCardId: tcgdexCard.sourceCardId,
      },
    }))

  const distinctEbayListings = ebayListings.filter(
    (listing, position, allListings) => allListings.findIndex(otherListing => otherListing.title === listing.title) === position,
  )
  const ebayCandidates: ProductCandidate[] = distinctEbayListings.slice(0, maximumCandidatesPerOrigin).map(listing => ({
    origin: 'ebay',
    label: listing.title,
    imageUrl: listing.imageUrl,
    productId: null,
    draft: { ...emptyProductDraft(listing.title, 'other'), imageUrl: listing.imageUrl, ebayQuery: trimmedQuery },
  }))

  return {
    candidates: [
      ...catalogueProductsToShow.slice(0, maximumCandidatesPerOrigin).map(toCatalogueCandidate),
      ...cardmarketCandidates,
      ...tcgdexCandidates,
      ...ebayCandidates,
    ],
    unavailableSources,
  }
}
