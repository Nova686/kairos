# Prices and Valuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kairos records prices every day and on demand, keeps the full history per source and per condition, values every item according to its condition, and shows the stock value against its cost over time.

**Architecture:** Built on plan 2's Nuxt app and plan 1's adapters. A shared queue table drives a Nitro task worker; each refresh turns source answers into price snapshots tagged with a Kairos condition through an editable condition mapping. Valuation is one pure function in `shared/valuation/` used by the server (stock value, daily snapshots, lot allocation) and the client (previews). A daily task stores each user's stock value for the history chart.

**Tech Stack:** Plan 2's stack, plus `chart.js` 4 and `vue-chartjs` 5.

**Spec:** `docs/superpowers/specs/2026-11-02-kairos-design.md` (objectives 3 to 6 and 8, anti-goal « prix silencieusement faussé », section 7 « Relevés de prix », « Fiabilité des prix », « Gouvernance du catalogue partagé »). Depends on plans 1 and 2.

## Global Constraints

- Plan 2's Global Constraints apply unchanged.
- Valuation rule from the spec, verbatim in substance: only listings whose condition matches the item's; per source the **median** of the matching figures; the item's value is the **median of the per-source figures**; snapshots older than **7 days** are ignored; when nothing matches, the **closest available condition** is used and the value is flagged **approximate** with the condition actually used.
- Aggregates without condition (Cardmarket, TCGdex, pokemontcg.io) count as `sealed-new` for `pokemon-sealed` products and are ignored for every other category and for graded cards.
- Every price figure shown can be traced back to its snapshot and, for listing-based sources, to the retained listings with their links.
- Quotas: at most one eBay search per product per day from the daily run; a manual refresh of one product is allowed at most once every 10 minutes; UPCitemdb and PSA are not used here.

## Review Focus

- A product held only by sold items is not refreshed daily (no wasted quota), but its history stays visible.
- A snapshot of exactly 7 days and 1 minute old is ignored; one of 6 days 23 hours is used.
- An item whose condition has no data in any source and no neighbour gets `valueCents: null`, displayed « pas de prix », never 0 €, and is counted apart in the stock totals.
- An excluded listing disappears from the next computed median and from the retained listings of that product for every user.
- Two users pressing « relever maintenant » on the same product within 10 minutes trigger a single refresh.

---

## Shared definitions

**Price sources used for valuation:** `ebay` (listings, by condition), `cardmarket` (aggregate), `vinted`, `leboncoin` (manual entries, by condition). `tcgdex` and `pokemontcg` are stored and shown as « référence carte brute » but never enter the valuation (spec: ignored for graded cards; no raw-card category exists).

**Per-source figure** for one snapshot: listing-based → `medianCents`; aggregate → `averageCents ?? trendCents ?? lowCents`; manual → the median of the manual entries of that source and condition within 7 days.

**Closest condition:** same category scale (plan 2 Shared definitions), smallest index distance; on a tie, the worse condition (higher index), to stay conservative. Graded cards: same grading company, closest numeric grade, tie → the lower grade; never across companies.

**Outliers:** among listings of one source and one condition, when there are at least 4, drop prices outside `[Q1 − 1.5 × IQR, Q3 + 1.5 × IQR]` (quartiles by linear interpolation).

---

### Task 1: Price tables and condition mapping

**Files:**
- Create: `server/database/schema/prices.ts`, migration, `server/database/seeds/condition-mappings.ts`, `server/domain/prices/condition-mapping-service.ts`, `server/api/condition-mappings/*`, `app/pages/reglages/correspondances.vue`
- Test: `tests/unit/prices/condition-mapping-service.test.ts`

**Interfaces:**
- Produces tables:
  - `priceSnapshots(id, productId → products, source, kind 'active' | 'source-aggregate' | 'manual', sourceCondition null, kairosCondition null, gradingCompany null, grade null, observedAt, averageCents null, medianCents null, lowCents null, trendCents null, listingCount, createdByUserId null, createdAt)`
  - `priceSnapshotListings(id, snapshotId → priceSnapshots, title, priceCents, shippingCents null, sourceCondition null, url, imageUrl null)`
  - `excludedListings(productId → products, url, excludedByUserId, excludedAt)` pk `(productId, url)`
  - `conditionMappings(category, source, sourceCondition, kairosCondition)` pk `(category, source, sourceCondition)`
  - `titleConditionRules(id, category, pattern text, kairosCondition, priority int)`
  - `priceRefreshRequests(productId pk → products, requestedAt, requestedByUserId null, lastRefreshedAt null)`
  - `stockValueSnapshots(ownerId, snapshotOn date, purchaseCostCents, estimatedValueCents, valuedItemCount, approximateItemCount, unvaluedItemCount)` pk `(ownerId, snapshotOn)`
- Seed (idempotent, run after migrations):
  - eBay, `pokemon-sealed`: `Neuf` → `sealed-new`, `Occasion` → `opened-complete`, `Neuf : autre (voir détails)` → `sealed-damaged-box`.
  - eBay, `toy` / `makeup` / `other`: `Neuf` → `new-with-tags`, `Neuf : autre (voir détails)` → `new-without-tags`, `Occasion` → `good`, `Reconditionné` → `very-good`.
  - Title rules for `pokemon-sealed`, applied before the eBay mapping, highest priority first: `/\b(vide|empty|sans cartes|incompl)/i` → `opened-incomplete` (30); `/\b(ouvert|opened|open)\b/i` → `opened-complete` (20); `/(ab[iî]m|cabossé|dented|damaged|enfonc)/i` → `sealed-damaged-box` (10).
  - Vinted / Leboncoin manual entries carry a Kairos condition directly (no mapping).
- `resolveKairosCondition(mappings, rules, { category, source, sourceCondition, title }): ConditionCode | null`
- `parseGradeFromTitle(title: string): { gradingCompany: string; grade: string } | null` — companies `PSA`, `PCA`, `CGC`, `BGS`, `Collect Grade`, `CCC`; grade = number 1–10 with optional `.5` right after the company (`PSA 10`, `PCA 9.5`, `CGC10`).
- Settings page lists mappings and title rules, editable by any member; edits are journaled in `catalogueChanges` with `productId` null — **ruling for the builder:** make `catalogueChanges.productId` nullable in this task's migration and add `subject` text (`'condition-mapping'`, `'title-rule'`, `'product'`).

- [ ] **Step 1: Write the failing tests:** « ETB Évolutions Prismatiques VIDE » with eBay `Occasion` → `opened-incomplete`; « ETB boîte abîmée » with `Neuf` → `sealed-damaged-box`; « Coffret Lego » `Neuf` category `toy` → `new-with-tags`; unknown source condition → null; `parseGradeFromTitle('Dracaufeu PSA 10 Évolutions')` → `{ PSA, '10' }`; `'PCA 9.5'` → `'9.5'`; `'Lot de 10 cartes'` → null.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement schema, migration, seed and service.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 2: Valuation function

**Files:**
- Create: `shared/valuation/median.ts`, `shared/valuation/remove-outliers.ts`, `shared/valuation/estimate-stock-item-value.ts`
- Test: `tests/unit/valuation/*.test.ts`

**Interfaces:**
- Produces:
  - `medianCents(values: number[]): number | null` — even count → mean of the two middle values, rounded half up.
  - `removeOutliers(pricesCents: number[]): number[]`
  - `type ValuationSnapshot = { source; kind; kairosCondition: ConditionCode | null; gradingCompany: string | null; grade: string | null; observedAt: Date; figureCents: number | null }`
  - `type StockItemValuation = { valueCents: number | null; approximate: boolean; usedCondition: string | null; perSource: { source: string; figureCents: number; observedAt: Date }[] }`
  - `estimateStockItemValue(stockItem: { category; condition; gradingCompany; grade }, snapshots: ValuationSnapshot[], now: Date): StockItemValuation` — applies Global Constraints and Shared definitions: freshness window, aggregate rule, newest snapshot per source and condition (manual: all entries in the window, median), closest condition fallback.

- [ ] **Step 1: Write the failing tests:**
  - ETB `sealed-new`, eBay median 6500 (2 days), Cardmarket average 15123 (1 day), Vinted manual 7000 and 7400 (3 days) → per source 6500, 15123, 7200 → value 7200, not approximate.
  - Same ETB `sealed-damaged-box` with only `sealed-new` data → approximate, `usedCondition 'sealed-new'`, Cardmarket included (aggregate counts as `sealed-new`).
  - `opened-complete` with data only at `sealed-damaged-box` and `opened-incomplete` (both distance 1) → uses `opened-incomplete`.
  - Toy `good` with only a Cardmarket aggregate → `valueCents null`.
  - Graded PSA 10 with eBay snapshots PSA 9 and PCA 10 → uses PSA 9, approximate; with only PCA 10 → null.
  - A snapshot observed 7 days and 1 minute before `now` is ignored; 6 days 23 hours is used.
  - `removeOutliers([1000, 6400, 6500, 6600, 6700, 30000])` → `[6400, 6500, 6600, 6700]`; with 3 values nothing is removed.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 3: Refresh pipeline per source

**Files:**
- Create: `server/domain/prices/refresh-product-prices.ts`, `server/domain/prices/record-ebay-snapshots.ts`, `server/domain/prices/record-cardmarket-snapshots.ts`, `server/domain/prices/record-card-reference-snapshots.ts`
- Test: `tests/unit/prices/refresh-product-prices.test.ts`

**Interfaces:**
- Consumes: plan 1 `searchEbayListings`, `downloadCardmarketPriceGuide`, `parseCardmarketPriceGuide`, `fetchTcgdexCardAggregate`, `fetchPokemontcgCardAggregate`; Task 1 mapping; Task 2 `removeOutliers`, `medianCents`.
- Produces:
  - `type PriceSourceGateway = { searchEbay(query: string): Promise<ListingObservation[]>; cardmarketAggregates(): Promise<Map<number, SourceAggregate>>; tcgdexAggregate(cardId: string): Promise<SourceAggregate | null>; pokemontcgAggregate(cardId: string): Promise<SourceAggregate | null> }` and `createPriceSourceGateway(): PriceSourceGateway` (Cardmarket guide downloaded at most once per calendar day, kept in memory).
  - `refreshProductPrices(database, gateway, productId, now): Promise<{ snapshotIds: string[]; unavailableSources: { source: string; reason: string }[] }>`:
    - eBay: query `product.ebayQuery ?? product.name`; drop listings whose title contains one of `ebayExcludedKeywords` (case- and accent-insensitive) or whose URL is in `excludedListings`; resolve each listing's Kairos condition (graded cards: `parseGradeFromTitle`, unmatched titles dropped); group by condition (and company + grade); per group remove outliers, then one `active` snapshot with average, median, low, count and its retained listings.
    - Cardmarket: when `cardmarketProductId` is set, one `source-aggregate` snapshot.
    - TCGdex / pokemontcg: when their ids are set, one `source-aggregate` snapshot each.
    - A `SourceDisabledError` / `SourceBlockedError` becomes an entry of `unavailableSources`; other sources still run.
    - Updates `priceRefreshRequests.lastRefreshedAt`.

- [ ] **Step 1: Write the failing tests** (fake gateway): 6 eBay listings, one excluded by URL, one by keyword « lot », one outlier → snapshot `sealed-new` with `listingCount 3`; an « ETB vide » listing lands in an `opened-incomplete` snapshot; graded product: titles `PSA 10` ×2 and `PSA 9` ×1 → two snapshots; eBay disabled → Cardmarket snapshot still written and `unavailableSources[0].source === 'ebay'`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 4: Queue, scheduled tasks and refresh buttons

**Files:**
- Create: `server/domain/prices/price-refresh-queue.ts`, `server/tasks/prices/enqueue-daily.ts`, `server/tasks/prices/process-queue.ts`, `server/api/products/[id]/refresh-prices.post.ts`, `server/api/stock/refresh-prices.post.ts`
- Modify: `nuxt.config.ts` (`nitro.scheduledTasks`: `'30 4 * * *': ['prices:enqueue-daily']`, `'*/5 * * * *': ['prices:process-queue']`)
- Test: `tests/unit/prices/price-refresh-queue.test.ts`

**Interfaces:**
- Produces:
  - `enqueueHeldProducts(database, now)` — every product with at least one item `in-transit` or `in-stock` (any user), not refreshed since the start of the day.
  - `enqueueProducts(database, productIds, requestedByUserId, now)` — upsert, keeps the earliest `requestedAt`.
  - `takeNextRefreshBatch(database, batchSize = 20)` — oldest `requestedAt` first, removes them from the queue in the same transaction (`FOR UPDATE SKIP LOCKED` on Postgres; plain transaction on PGlite).
  - `refreshProductNow(database, gateway, productId, userId, now)` — refused with 429 « déjà relevé il y a moins de 10 minutes » when `lastRefreshedAt` is younger than 10 minutes; otherwise runs `refreshProductPrices` inline and returns its outcome.
  - « Relever tout mon stock » enqueues the user's held products and answers with the queue position count.

- [ ] **Step 1: Write the failing tests:** a product held only by sold items is not enqueued; enqueue twice keeps one row; batch of 20 from 25 leaves 5; `refreshProductNow` twice within 10 minutes → second refused, gateway called once.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 5: Manual prices, exclusions and eBay search settings

**Files:**
- Create: `server/domain/prices/manual-price-entries.ts`, `server/domain/prices/listing-exclusions.ts`, `server/api/products/[id]/manual-prices.post.ts`, `server/api/products/[id]/excluded-listings.post.ts`, `server/api/products/[id]/excluded-listings.delete.ts`
- Modify: `server/domain/catalogue/catalogue-service.ts` (`ebayQuery`, `ebayExcludedKeywords` editable and journaled — already fields of `ProductDraft`)
- Test: `tests/unit/prices/manual-price-entries.test.ts`, `tests/unit/prices/listing-exclusions.test.ts`

**Interfaces:**
- Produces:
  - `recordManualPrice(database, userId, productId, { source: 'vinted' | 'leboncoin' | 'other'; kairosCondition; gradingCompany?; grade?; priceCents > 0; observedOn; url? })` → one `manual` snapshot (`listingCount 1`, `medianCents = averageCents = lowCents = priceCents`, `createdByUserId` set, one listing row when `url` is given).
  - `excludeListing(database, userId, productId, url)` / `restoreListing(...)` — journaled; both mark the product for refresh in the queue.

- [ ] **Step 1: Write the failing tests:** manual Vinted entry at `very-good` is used by `estimateStockItemValue` for a `very-good` toy; condition not allowed for the category → 422; excluding a URL then refreshing drops that listing (fake gateway); restoring brings it back.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 6: Stock valuation service, daily value history and value-based lot allocation

**Files:**
- Create: `server/domain/valuation/value-stock.ts`, `server/tasks/valuation/record-stock-value.ts`, `server/api/stock/value.get.ts`, `server/api/stock/value-history.get.ts`
- Modify: `server/domain/stock/purchases-service.ts`, `server/domain/sales/sales-service.ts` (default weights), `nuxt.config.ts` (`'0 6 * * *': ['valuation:record-stock-value']`)
- Test: `tests/unit/valuation/value-stock.test.ts`

**Interfaces:**
- Produces:
  - `loadValuationSnapshots(database, productIds, now): Promise<Map<string, ValuationSnapshot[]>>` — last 7 days only, excluded listings already applied at refresh time.
  - `valueStock(database, ownerId, now): Promise<{ purchaseCostCents; estimatedValueCents; latentGainCents; valuedItemCount; approximateItemCount; unvaluedItemCount; items: { stockItemId; valuation: StockItemValuation }[] }>` — held items only (`in-transit`, `in-stock`); `estimatedValueCents` sums valued items; `latentGainCents = estimatedValueCents − purchase cost of the valued items` (unvalued items never count as 0 €).
  - `recordStockValueSnapshots(database, now)` — one row per user per day, upsert.
  - Lot allocation defaults: purchase lines without amounts use the current estimated values as weights when **every** line has one, otherwise equal weights; sales use estimated values the same way, otherwise purchase costs (plan 2 rule).

- [ ] **Step 1: Write the failing tests:** two items valued 10000 and 5000 bought 6000 and 4000 plus one unvalued item bought 3000 → estimated 15000, latent gain 5000, `unvaluedItemCount 1`; snapshot recorded twice the same day → one row; purchase of 2 lines valued 15000 and 5000 for 10000 → 7500 / 2500; one line without value → equal split.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 7: Product price screen and history chart

**Files:**
- Create: `app/pages/produits/[id].vue`, `app/components/prices/PriceBySourceTable.vue`, `app/components/prices/PriceHistoryChart.vue`, `app/components/prices/RetainedListingsDialog.vue`, `app/components/prices/ManualPriceForm.vue`, `app/components/prices/EbaySearchSettings.vue`, `app/composables/useProductPrices.ts`, `server/api/products/[id]/prices.get.ts`, `server/domain/prices/product-price-overview.ts`
- Test: `tests/unit/prices/product-price-overview.test.ts`

**Interfaces:**
- Produces:
  - `productPriceOverview(database, productId, now)` → `{ bySourceAndCondition: { source; condition; figureCents; listingCount; observedAt; snapshotId }[]; history: { source; condition; observedOn: string; figureCents }[] (365 days, one point per source/condition/day = last snapshot of the day); cardReferences: SourceAggregate[]; lastRefreshedAt }`.
  - Table rows = sources (eBay, Cardmarket, Vinted, Leboncoin, référence carte brute), columns = the category's conditions; stale cells (> 7 days) greyed with their date; a cell opens `RetainedListingsDialog` (title, price, condition, link, « Exclure » button).
  - Chart: one line per source for the selected condition (selector defaults to `sealed-new` / the item's condition), `vue-chartjs` `Line`, euros on the axis.
  - Buttons « Relever maintenant » (shows the 10-minute refusal message) and « Ajouter un prix vu ».

- [ ] **Step 1: Write the failing tests:** two snapshots the same day for eBay `sealed-new` → one history point with the later figure; a 10-day-old snapshot appears in history but is flagged stale in the table.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 8: Dashboard and stock values

**Files:**
- Create: `app/components/dashboard/StockValueSummary.vue`, `app/components/dashboard/StockValueChart.vue`, `app/components/dashboard/RecentActivity.vue`, `app/composables/useStockValue.ts`, `server/api/dashboard.get.ts`, `server/domain/dashboard/dashboard-overview.ts`
- Modify: `app/pages/index.vue`, `app/components/stock/StockItemList.vue` (estimated value, gain, « ≈ » for approximate with the used condition in a tooltip, « pas de prix »), `app/pages/stock/index.vue` (« Relever tout mon stock »)
- Test: `tests/unit/dashboard/dashboard-overview.test.ts`, `tests/e2e/dashboard.test.ts`

**Interfaces:**
- Produces: `dashboardOverview(database, ownerId, now)` → `{ stockValue: ReturnType<typeof valueStock> without items; valueHistory: stockValueSnapshots of 365 days; recentSales: last 5 with net profit; deliveriesInProgress: { incoming: number; outgoing: number }; debtTotals: { owedToMeCents; iOweCents } }`.
  - Dashboard: two big figures « Coût du stock » / « Valeur actuelle » side by side, latent gain coloured, counts of approximate and unpriced items, value-vs-cost chart over time, recent sales, deliveries and debts tiles linking to their pages.

- [ ] **Step 1: Write the failing tests:** overview aggregates the fixtures of Task 6 plus one sale and one open debt; e2e: `GET /` for a logged-in user with data shows « Valeur actuelle » and the formatted amount.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit and push.
