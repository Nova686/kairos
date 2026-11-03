import { safeExternalHref } from '../../../app/utils/safe-external-href.ts'

export const catalogueImageTimeoutMilliseconds = 10_000
export const catalogueImageMaximumBytes = 5 * 1024 * 1024

export type CatalogueImageFetcher = (url: string, init: { signal: AbortSignal }) => Promise<Response>

export type FetchCatalogueImageOptions = {
  fetchImage?: CatalogueImageFetcher
  timeoutMs?: number
  maxBytes?: number
}

const imageTooLarge = (maxBytes: number): Error => new Error(`Image trop volumineuse (plus de ${maxBytes} octets)`)

const readBodyWithinCap = async (response: Response, maxBytes: number): Promise<Buffer> => {
  const announcedBytes = Number(response.headers.get('content-length'))
  if (announcedBytes > maxBytes) {
    throw imageTooLarge(maxBytes)
  }
  const reader = response.body?.getReader()
  if (!reader) {
    return Buffer.alloc(0)
  }
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    receivedBytes += value.byteLength
    if (receivedBytes > maxBytes) {
      await reader.cancel()
      throw imageTooLarge(maxBytes)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export const fetchCatalogueImage = async (
  imageUrl: string,
  options: FetchCatalogueImageOptions = {},
): Promise<Buffer> => {
  const safeUrl = safeExternalHref(imageUrl)
  if (!safeUrl) {
    throw new Error('URL d’image non http(s)')
  }
  const { fetchImage = fetch, timeoutMs = catalogueImageTimeoutMilliseconds, maxBytes = catalogueImageMaximumBytes } = options
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const response = await fetchImage(safeUrl, { signal: timeoutSignal })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return readBodyWithinCap(response, maxBytes)
}
