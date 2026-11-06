import { requestSourceJson } from '../source-http/request-source-json.ts'
import type { FetchFunction } from '../source-http/request-source-json.ts'
import type { ProductIdentification } from './identification-types.ts'

interface UpcitemdbLookup {
  total?: number
  items?: { title: string; brand?: string; images?: string[] }[]
}

export const lookupUpcitemdb = async (barcode: string, fetchFunction?: FetchFunction): Promise<ProductIdentification | null> => {
  const lookupUrl = `https://api.upcitemdb.com/prod/trial/lookup?${new URLSearchParams({ upc: barcode }).toString()}`
  const lookup = await requestSourceJson<UpcitemdbLookup>('upcitemdb', lookupUrl, {}, fetchFunction)
  const firstMatch = lookup?.items?.[0]
  if (!firstMatch || !lookup?.total) {
    return null
  }
  return {
    source: 'upcitemdb',
    name: firstMatch.title.trim(),
    brand: firstMatch.brand || null,
    imageUrl: firstMatch.images?.[0] ?? null,
    barcode,
    gradingCompany: null,
    grade: null,
    certificateNumber: null,
  }
}
