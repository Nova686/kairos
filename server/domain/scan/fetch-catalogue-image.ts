import { lookup as lookupAddress } from 'node:dns/promises'
import { request as requestHttp, type IncomingHttpHeaders } from 'node:http'
import { request as requestHttps } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { safeExternalHref } from '../../../app/utils/safe-external-href.ts'
import { isForbiddenAddress } from './is-forbidden-address.ts'

export const catalogueImageTimeoutMilliseconds = 10_000
export const catalogueImageMaximumBytes = 5 * 1024 * 1024
export const catalogueImageMaximumRedirects = 3

const redirectStatusCodes = [301, 302, 303, 307, 308]

export type ResolvedAddress = { address: string, family: number }

export type ImageHttpResponse = {
  statusCode: number
  headers: IncomingHttpHeaders
  body: AsyncIterable<Uint8Array> & { destroy(): unknown }
}

export type ImageRequestSender = (
  url: URL,
  options: { lookup: LookupFunction, signal: AbortSignal },
) => Promise<ImageHttpResponse>

export type FetchCatalogueImageOptions = {
  sendRequest?: ImageRequestSender
  resolveAddresses?: (hostname: string) => Promise<ResolvedAddress[]>
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
}

const forbiddenAddressError = (): Error => new Error('Adresse de destination interdite (réseau interne)')

const imageTooLarge = (maxBytes: number): Error => new Error(`Image trop volumineuse (plus de ${maxBytes} octets)`)

const resolveAllAddresses = (hostname: string): Promise<ResolvedAddress[]> => lookupAddress(hostname, { all: true })

const createGuardedLookup = (resolveAddresses: (hostname: string) => Promise<ResolvedAddress[]>): LookupFunction =>
  (hostname, options, callback) => {
    resolveAddresses(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some(resolved => isForbiddenAddress(resolved.address))) {
          callback(forbiddenAddressError(), '', 0)
          return
        }
        if (options.all) {
          callback(null, addresses)
          return
        }
        callback(null, addresses[0]!.address, addresses[0]!.family)
      },
      (resolutionError: Error) => callback(resolutionError, '', 0),
    )
  }

const sendNodeRequest: ImageRequestSender = (url, { lookup, signal }) =>
  new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? requestHttps : requestHttp)(
      url,
      { method: 'GET', lookup, signal, agent: false },
      response => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, body: response }),
    )
    request.on('error', reject)
    request.end()
  })

const assertPublicLiteralHost = (url: URL): void => {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname) !== 0 && isForbiddenAddress(hostname)) {
    throw forbiddenAddressError()
  }
}

const parseHttpUrl = (candidateUrl: string): URL => {
  const safeUrl = safeExternalHref(candidateUrl)
  if (!safeUrl) {
    throw new Error('URL d’image non http(s)')
  }
  const parsedUrl = new URL(safeUrl)
  assertPublicLiteralHost(parsedUrl)
  return parsedUrl
}

const readBodyWithinCap = async (response: ImageHttpResponse, maxBytes: number): Promise<Buffer> => {
  const announcedBytes = Number(response.headers['content-length'])
  if (announcedBytes > maxBytes) {
    response.body.destroy()
    throw imageTooLarge(maxBytes)
  }
  const chunks: Uint8Array[] = []
  let receivedBytes = 0
  for await (const chunk of response.body) {
    receivedBytes += chunk.byteLength
    if (receivedBytes > maxBytes) {
      response.body.destroy()
      throw imageTooLarge(maxBytes)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export const fetchCatalogueImage = async (
  imageUrl: string,
  options: FetchCatalogueImageOptions = {},
): Promise<Buffer> => {
  const {
    sendRequest = sendNodeRequest,
    resolveAddresses = resolveAllAddresses,
    timeoutMs = catalogueImageTimeoutMilliseconds,
    maxBytes = catalogueImageMaximumBytes,
    maxRedirects = catalogueImageMaximumRedirects,
  } = options
  const signal = AbortSignal.timeout(timeoutMs)
  const lookup = createGuardedLookup(resolveAddresses)
  let currentUrl = parseHttpUrl(imageUrl)
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await sendRequest(currentUrl, { lookup, signal })
    const location = response.headers.location
    if (redirectStatusCodes.includes(response.statusCode) && location) {
      response.body.destroy()
      currentUrl = parseHttpUrl(new URL(location, currentUrl).href)
      continue
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.body.destroy()
      throw new Error(`HTTP ${response.statusCode}`)
    }
    if (!String(response.headers['content-type'] ?? '').toLowerCase().startsWith('image/')) {
      response.body.destroy()
      throw new Error('La réponse n’est pas une image (content-type)')
    }
    return readBodyWithinCap(response, maxBytes)
  }
  throw new Error(`Trop de redirections (plus de ${maxRedirects})`)
}
