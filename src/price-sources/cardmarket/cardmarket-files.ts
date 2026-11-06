import { requestSourceJson } from '../../source-http/request-source-json.ts'
import type { FetchFunction } from '../../source-http/request-source-json.ts'
import type { CardmarketCatalogueProduct } from './search-cardmarket-catalogue.ts'

const cardmarketDownloadsRoot = 'https://downloads.s3.cardmarket.com/productCatalog'

export const pokemonGameId = 6

export const cardmarketFileUrls = (gameId: number): { priceGuide: string; singles: string; nonSingles: string } => ({
  priceGuide: `${cardmarketDownloadsRoot}/priceGuide/price_guide_${gameId}.json`,
  singles: `${cardmarketDownloadsRoot}/productList/products_singles_${gameId}.json`,
  nonSingles: `${cardmarketDownloadsRoot}/productList/products_nonsingles_${gameId}.json`,
})

export const downloadCardmarketPriceGuide = async (gameId: number, fetchFunction?: FetchFunction): Promise<unknown> => {
  const priceGuide = await requestSourceJson<unknown>('cardmarket', cardmarketFileUrls(gameId).priceGuide, {}, fetchFunction)
  if (priceGuide === null) {
    throw new Error(`cardmarket has no price guide for game ${gameId}`)
  }
  return priceGuide
}

export const downloadCardmarketSealedProducts = async (
  gameId: number,
  fetchFunction?: FetchFunction,
): Promise<CardmarketCatalogueProduct[]> => {
  const catalogue = await requestSourceJson<{ products: CardmarketCatalogueProduct[] }>(
    'cardmarket',
    cardmarketFileUrls(gameId).nonSingles,
    {},
    fetchFunction,
  )
  return catalogue?.products ?? []
}
