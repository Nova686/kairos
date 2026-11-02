import { requestSourceJson } from '../source-http/request-source-json.ts'
import type { FetchFunction } from '../source-http/request-source-json.ts'
import type { ProductIdentification } from './identification-types.ts'

interface OpenBeautyFactsLookup {
  status?: number
  product?: { product_name?: string; brands?: string; image_front_url?: string }
}

export const lookupOpenBeautyFacts = async (
  barcode: string,
  fetchFunction?: FetchFunction,
): Promise<ProductIdentification | null> => {
  const lookupUrl = `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?${new URLSearchParams({ fields: 'product_name,brands,image_front_url' }).toString()}`
  const lookup = await requestSourceJson<OpenBeautyFactsLookup>('openbeautyfacts', lookupUrl, {}, fetchFunction)
  const productName = lookup?.product?.product_name?.trim()
  if (lookup?.status !== 1 || !productName) {
    return null
  }
  return {
    source: 'openbeautyfacts',
    name: productName,
    brand: lookup.product?.brands || null,
    imageUrl: lookup.product?.image_front_url ?? null,
    barcode,
    gradingCompany: null,
    grade: null,
    certificateNumber: null,
  }
}
