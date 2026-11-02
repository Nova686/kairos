import { SourceBlockedError, SourceDisabledError } from '../price-sources/price-source-types.ts'
import type { SourceId } from '../price-sources/price-source-types.ts'

export type FetchFunction = typeof fetch

const minimumSpacingBetweenCallsMs = 1000
const blockingStatuses = new Set([401, 403, 429])
const lastCallTimeBySource = new Map<SourceId, number>()

const waitForSourceSpacing = async (source: SourceId): Promise<void> => {
  const lastCallTime = lastCallTimeBySource.get(source)
  if (lastCallTime !== undefined) {
    const remainingWaitMs = lastCallTime + minimumSpacingBetweenCallsMs - Date.now()
    if (remainingWaitMs > 0) {
      await new Promise((resolveAfterWait) => setTimeout(resolveAfterWait, remainingWaitMs))
    }
  }
  lastCallTimeBySource.set(source, Date.now())
}

export const requestSourceJson = async <T>(
  source: SourceId,
  url: string,
  init: RequestInit,
  fetchFunction: FetchFunction = fetch,
): Promise<T | null> => {
  await waitForSourceSpacing(source)
  const response = await fetchFunction(url, init)
  if (response.status === 404) {
    return null
  }
  if (blockingStatuses.has(response.status)) {
    throw new SourceBlockedError(source, `http-${response.status}`)
  }
  if (!response.ok) {
    throw new Error(`${source} answered HTTP ${response.status} for ${url}`)
  }
  return (await response.json()) as T
}

export const readRequiredSetting = (source: SourceId, settingName: string): string => {
  const settingValue = process.env[settingName]
  if (!settingValue) {
    throw new SourceDisabledError(source, settingName)
  }
  return settingValue
}
