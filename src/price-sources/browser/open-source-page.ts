import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { SourceBlockedError } from '../price-source-types.ts'
import type { PriceSourceId } from '../price-source-types.ts'
import { detectAntiBotPage } from './detect-anti-bot-page.ts'

const minimumSpacingBetweenRequestsMs = 2000
const navigationTimeoutMs = 45000

const lastRequestTimeBySource = new Map<PriceSourceId, number>()
const contextBySource = new Map<PriceSourceId, BrowserContext>()
let sharedBrowser: Browser | null = null

const waitForSourceSpacing = async (source: PriceSourceId): Promise<void> => {
  const lastRequestTime = lastRequestTimeBySource.get(source)
  if (lastRequestTime !== undefined) {
    const remainingWaitMs = lastRequestTime + minimumSpacingBetweenRequestsMs - Date.now()
    if (remainingWaitMs > 0) {
      await new Promise((resolveAfterWait) => setTimeout(resolveAfterWait, remainingWaitMs))
    }
  }
  lastRequestTimeBySource.set(source, Date.now())
}

const getSourceContext = async (source: PriceSourceId): Promise<BrowserContext> => {
  sharedBrowser ??= await chromium.launch({ headless: true })
  const existingContext = contextBySource.get(source)
  if (existingContext) {
    return existingContext
  }
  const sourceContext = await sharedBrowser.newContext({
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width: 1366, height: 900 },
  })
  contextBySource.set(source, sourceContext)
  return sourceContext
}

export const withSourcePage = async <T>(
  source: PriceSourceId,
  url: string,
  readPage: (page: Page) => Promise<T>,
): Promise<T> => {
  await waitForSourceSpacing(source)
  const sourceContext = await getSourceContext(source)
  const page = await sourceContext.newPage()
  try {
    const navigationResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs })
    const blockReason = detectAntiBotPage(navigationResponse?.status() ?? 0, await page.content())
    if (blockReason) {
      throw new SourceBlockedError(source, blockReason)
    }
    return await readPage(page)
  } finally {
    await page.close()
  }
}

export const closeSourceBrowser = async (): Promise<void> => {
  contextBySource.clear()
  lastRequestTimeBySource.clear()
  await sharedBrowser?.close()
  sharedBrowser = null
}
