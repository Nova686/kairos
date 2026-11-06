import { requestSourceJson } from '../../source-http/request-source-json.ts'
import type { FetchFunction } from '../../source-http/request-source-json.ts'
import type { ListingObservation, PriceSourceAdapter } from '../price-source-types.ts'
import { fetchEbayAccessToken } from './ebay-access-token.ts'
import { parseEbayItemSummaries } from './parse-ebay-item-summaries.ts'

const ebaySearchEndpoint = 'https://api.ebay.com/buy/browse/v1/item_summary/search'
const frenchMarketplaceId = 'EBAY_FR'

export const buildEbaySearchUrl = (query: string, conditionIds: number[]): string => {
  const searchParameters = new URLSearchParams({ q: query, limit: '100' })
  if (conditionIds.length > 0) {
    searchParameters.set('filter', `conditionIds:{${conditionIds.join('|')}}`)
  }
  return `${ebaySearchEndpoint}?${searchParameters.toString()}`
}

export const searchEbayListings = async (
  query: string,
  conditionIds: number[] = [],
  fetchFunction?: FetchFunction,
): Promise<ListingObservation[]> => {
  const accessToken = await fetchEbayAccessToken(fetchFunction)
  const rawSearch = await requestSourceJson<unknown>(
    'ebay',
    buildEbaySearchUrl(query, conditionIds),
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-ebay-c-marketplace-id': frenchMarketplaceId,
        'accept-language': 'fr-FR',
      },
    },
    fetchFunction,
  )
  return rawSearch === null ? [] : parseEbayItemSummaries(rawSearch)
}

export const ebayAdapter: PriceSourceAdapter = {
  id: 'ebay',
  supportedKinds: ['active'],
  search: (query) => searchEbayListings(query),
}
