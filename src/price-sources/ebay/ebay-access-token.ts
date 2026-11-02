import { readRequiredSetting, requestSourceJson } from '../../source-http/request-source-json.ts'
import type { FetchFunction } from '../../source-http/request-source-json.ts'

const ebayTokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token'
const ebayPublicScope = 'https://api.ebay.com/oauth/api_scope'
const tokenRenewalMarginMs = 60000

let cachedAccessToken: { value: string; expiresAt: number } | null = null

export const forgetEbayAccessToken = (): void => {
  cachedAccessToken = null
}

export const fetchEbayAccessToken = async (fetchFunction?: FetchFunction): Promise<string> => {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.value
  }
  const clientId = readRequiredSetting('ebay', 'EBAY_CLIENT_ID')
  const clientSecret = readRequiredSetting('ebay', 'EBAY_CLIENT_SECRET')
  const tokenAnswer = await requestSourceJson<{ access_token: string; expires_in: number }>(
    'ebay',
    ebayTokenUrl,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: ebayPublicScope }).toString(),
    },
    fetchFunction,
  )
  if (!tokenAnswer?.access_token) {
    throw new Error('ebay returned no access token')
  }
  cachedAccessToken = {
    value: tokenAnswer.access_token,
    expiresAt: Date.now() + tokenAnswer.expires_in * 1000 - tokenRenewalMarginMs,
  }
  return cachedAccessToken.value
}
