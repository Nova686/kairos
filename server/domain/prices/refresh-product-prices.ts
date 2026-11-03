import { eq, sql } from 'drizzle-orm'
import { compileTitleRules } from '../../../shared/prices/resolve-kairos-condition.ts'
import type { CompiledTitleRules, ConditionMappingEntry, TitleConditionRuleEntry } from '../../../shared/prices/resolve-kairos-condition.ts'
import { downloadCardmarketPriceGuide, pokemonGameId } from '../../../src/price-sources/cardmarket/cardmarket-files.ts'
import { parseCardmarketPriceGuide } from '../../../src/price-sources/cardmarket/parse-cardmarket-price-guide.ts'
import { searchEbayListings } from '../../../src/price-sources/ebay/ebay-adapter.ts'
import { fetchPokemontcgCardAggregate } from '../../../src/price-sources/pokemontcg/pokemontcg-adapter.ts'
import { SourceBlockedError, SourceDisabledError } from '../../../src/price-sources/price-source-types.ts'
import type { ListingObservation, SourceAggregate } from '../../../src/price-sources/price-source-types.ts'
import { fetchTcgdexCardAggregate } from '../../../src/price-sources/tcgdex/tcgdex-adapter.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import {
  conditionMappings,
  excludedListings,
  priceRefreshRequests,
  products,
  titleConditionRules,
} from '../../database/schema/index.ts'
import { insertPriceSnapshotDrafts } from './price-snapshot-drafts.ts'
import type { PriceSnapshotDraft } from './price-snapshot-drafts.ts'
import { buildCardReferenceSnapshotDrafts } from './record-card-reference-snapshots.ts'
import { buildCardmarketSnapshotDrafts } from './record-cardmarket-snapshots.ts'
import { buildEbaySnapshotDrafts, normalizeListingUrl } from './record-ebay-snapshots.ts'
import { parisCalendarDateOf } from './start-of-paris-day.ts'
import type { UnavailableSource } from '../../../shared/prices/unavailable-source.ts'

export type PriceSourceGateway = {
  searchEbay(query: string): Promise<ListingObservation[]>
  cardmarketAggregates(): Promise<Map<number, SourceAggregate>>
  tcgdexAggregate(cardId: string): Promise<SourceAggregate | null>
  pokemontcgAggregate(cardId: string): Promise<SourceAggregate | null>
}

export type { UnavailableSource }

export type RefreshOutcome = { snapshotIds: string[]; unavailableSources: UnavailableSource[] }

export type RefreshRulesContext = {
  mappings: ConditionMappingEntry[]
  compiledRules: CompiledTitleRules
}

const ebaySource = 'ebay'

type CachedCardmarketGuide = { parisDay: string; aggregates: Promise<Map<number, SourceAggregate>> }

let cachedCardmarketGuide: CachedCardmarketGuide | null = null

const downloadCardmarketAggregates = async (downloadedAt: Date): Promise<Map<number, SourceAggregate>> =>
  parseCardmarketPriceGuide(await downloadCardmarketPriceGuide(pokemonGameId), downloadedAt.toISOString())

const cardmarketAggregatesOfToday = (): Promise<Map<number, SourceAggregate>> => {
  const now = new Date()
  const parisDay = parisCalendarDateOf(now)
  if (cachedCardmarketGuide?.parisDay === parisDay) {
    return cachedCardmarketGuide.aggregates
  }
  const pendingGuide: CachedCardmarketGuide = { parisDay, aggregates: downloadCardmarketAggregates(now) }
  cachedCardmarketGuide = pendingGuide
  pendingGuide.aggregates.catch(() => {
    if (cachedCardmarketGuide === pendingGuide) {
      cachedCardmarketGuide = null
    }
  })
  return pendingGuide.aggregates
}

export const createPriceSourceGateway = (): PriceSourceGateway => ({
  searchEbay: query => searchEbayListings(query),
  cardmarketAggregates: cardmarketAggregatesOfToday,
  tcgdexAggregate: cardId => fetchTcgdexCardAggregate(cardId),
  pokemontcgAggregate: cardId => fetchPokemontcgCardAggregate(cardId),
})

export const loadRefreshRulesContext = async (database: KairosDatabase): Promise<RefreshRulesContext> => {
  const mappings = await database.select().from(conditionMappings)
  const rules = await database.select().from(titleConditionRules)
  const compiledRules = compileTitleRules(rules as TitleConditionRuleEntry[])
  return { mappings: mappings as ConditionMappingEntry[], compiledRules }
}

const describeUnavailability = (error: SourceDisabledError | SourceBlockedError): Omit<UnavailableSource, 'source'> =>
  error instanceof SourceDisabledError
    ? { kind: 'missing-key', reason: `${error.missingSetting} is not set` }
    : { kind: 'blocked', reason: error.reason }

const collectFromSource = async (
  sourceName: string,
  unavailableSources: UnavailableSource[],
  collectDrafts: () => Promise<PriceSnapshotDraft[]>,
): Promise<PriceSnapshotDraft[]> => {
  try {
    return await collectDrafts()
  }
  catch (error) {
    if (error instanceof SourceDisabledError || error instanceof SourceBlockedError) {
      unavailableSources.push({ source: sourceName, ...describeUnavailability(error) })
      return []
    }
    unavailableSources.push({
      source: sourceName,
      kind: 'error',
      reason: `error: ${error instanceof Error ? error.message : String(error)}`,
    })
    return []
  }
}

export const refreshProductPrices = async (
  database: KairosDatabase,
  gateway: PriceSourceGateway,
  productId: string,
  now: Date,
  rulesContext?: RefreshRulesContext,
): Promise<RefreshOutcome> => {
  const [product] = await database.select().from(products).where(eq(products.id, productId))
  if (!product) {
    throw new Error(`Product ${productId} does not exist`)
  }
  const { mappings, compiledRules } = rulesContext ?? await loadRefreshRulesContext(database)
  const excludedRows = await database.select().from(excludedListings).where(eq(excludedListings.productId, productId))
  const excludedUrls = new Set(excludedRows.map(row => normalizeListingUrl(row.url)))
  const unavailableSources: UnavailableSource[] = []
  const { cardmarketProductId, tcgdexCardId, pokemontcgCardId } = product

  const ebayDrafts = await collectFromSource(ebaySource, unavailableSources, async () => {
    const listings = await gateway.searchEbay(product.ebayQuery ?? product.name)
    return buildEbaySnapshotDrafts(listings, {
      category: product.category,
      excludedKeywords: product.ebayExcludedKeywords,
      excludedUrls,
      mappings,
      compiledRules,
      observedAt: now,
    })
  })
  const cardmarketDrafts = cardmarketProductId === null
    ? []
    : await collectFromSource('cardmarket', unavailableSources, async () =>
        buildCardmarketSnapshotDrafts(cardmarketProductId, await gateway.cardmarketAggregates()))
  const tcgdexDrafts = tcgdexCardId === null
    ? []
    : await collectFromSource('tcgdex', unavailableSources, async () =>
        buildCardReferenceSnapshotDrafts([await gateway.tcgdexAggregate(tcgdexCardId)]))
  const pokemontcgDrafts = pokemontcgCardId === null
    ? []
    : await collectFromSource('pokemontcg', unavailableSources, async () =>
        buildCardReferenceSnapshotDrafts([await gateway.pokemontcgAggregate(pokemontcgCardId)]))

  const isEbayUnavailable = unavailableSources.some(unavailableSource => unavailableSource.source === ebaySource)
  const drafts = [...ebayDrafts, ...cardmarketDrafts, ...tcgdexDrafts, ...pokemontcgDrafts]
  const snapshotIds = await database.transaction(async (transaction) => {
    const insertedIds = await insertPriceSnapshotDrafts(transaction as unknown as KairosDatabase, productId, drafts)
    const ebayRefresh = isEbayUnavailable ? {} : { lastEbayRefreshAt: now }
    await transaction
      .insert(priceRefreshRequests)
      .values({ productId, requestedAt: null, lastRefreshedAt: now, ...ebayRefresh })
      .onConflictDoUpdate({
        target: priceRefreshRequests.productId,
        set: {
          lastRefreshedAt: now,
          requestedAt: sql`case when ${priceRefreshRequests.requestedAt} <= ${now.toISOString()}::timestamptz then null else ${priceRefreshRequests.requestedAt} end`,
          ...ebayRefresh,
        },
      })
    return insertedIds
  })
  return { snapshotIds, unavailableSources }
}
