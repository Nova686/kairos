# Price Source Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision 2 (2026-11-02).** Revision 1 relied on scraping with Playwright. Every source blocked a plain headless browser, and circumvention is excluded (`docs/spikes/2026-11-02-price-sources.md`). Revision 2 uses only official, free APIs and published files. Task 1 of revision 1 is kept as is. The Playwright loader of revision 1 (Task 2) is removed in Task 2 below.

**Goal:** One adapter per official price or identification source, returning normalised observations, plus a probe that tells which sources answer with the keys present.

**Architecture:** A standalone TypeScript package at the repository root (`src/price-sources/`, `src/identification-sources/`), later imported by the Nuxt server in plan 3. Each adapter splits into a pure parser (JSON → observations, unit-tested on captured or documented fixtures) and a thin HTTP client built on native `fetch`, injected so tests never hit the network. A CLI probe runs every adapter on reference products and writes a JSON report.

**Tech Stack:** Node 22, TypeScript (ESM), `tsx`, `vitest`, native `fetch`.

**Spec:** `docs/superpowers/specs/2026-11-02-kairos-design.md` (objective 3, sections 5 and 7).

## Global Constraints

- Only official, free channels. No scraping, no headless browser, no circumvention of any protection.
- Keys come from environment variables, never committed: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `POKEMONTCG_API_KEY`, `PSA_API_TOKEN`. A missing key disables its source (`SourceDisabledError`), it never crashes the run.
- eBay marketplace `EBAY_FR`; Cardmarket game id `6` (Pokémon) by default.
- Prices as integer euro cents; any non-EUR amount is dropped.
- No comment in the code; names reveal intent (no `data`, `temp`, `item`, `result`).
- No employer mention anywhere. Git identity `Nova686 <58865656+Nova686@users.noreply.github.com>`.
- Commit messages: one English sentence, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A source answering 401/403 (bad or revoked key) is reported `blocked` with the status, distinct from `disabled` (no key) and from `ok` with 0 result.
- A Cardmarket product absent from the price guide, or with `avg`/`low`/`trend` null or 0, yields no aggregate rather than a 0 € price.
- eBay listings priced in another currency, or with a price range, are dropped; listings without `condition` keep `sourceCondition: null`.
- UPCitemdb's daily limit (HTTP 429) is reported `blocked`, not `error`, and is not retried within the run.
- Search queries with accents and quotes (`Évolutions Prismatiques`, `Dresseur d'Élite`) are URL-encoded correctly for every source.

---

### Task 1: Package skeleton, shared types and euro price parsing — DONE (commit `36e362f`)

Produces `PriceSourceId`, `ListingKind`, `ListingObservation`, `PriceSourceAdapter`, `SourceBlockedError`, `parseEuroPrice`, `deduplicateByUrl` in `src/price-sources/price-source-types.ts` and `src/price-sources/parse-euro-price.ts`.

### Task 2: Shared HTTP client and source errors, Playwright removed

**Files:**
- Delete: `src/price-sources/browser/`, `tests/price-sources/detect-anti-bot-page.test.ts`, `tests/fixtures/anti-bot/`; uninstall `playwright`.
- Modify: `src/price-sources/price-source-types.ts`
- Create: `src/source-http/request-source-json.ts`
- Test: `tests/source-http/request-source-json.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `PriceSourceId` widened to `'ebay' | 'cardmarket' | 'tcgdex' | 'pokemontcg' | 'vinted' | 'leboncoin'`; `ListingKind` widened to `'active' | 'sold' | 'source-aggregate' | 'manual'`.
  - `type SourceId = PriceSourceId | 'psa' | 'openbeautyfacts' | 'upcitemdb'`
  - `SourceBlockedError(source: SourceId, reason: string)` (signature widened), `class SourceDisabledError extends Error { constructor(source: SourceId, missingSetting: string) }`
  - `type FetchFunction = typeof fetch`
  - `requestSourceJson<T>(source: SourceId, url: string, init: RequestInit, fetchFunction?: FetchFunction): Promise<T | null>` → JSON body on 2xx; `null` on 404; throws `SourceBlockedError(source, 'http-<status>')` on 401/403/429; throws `Error` with the status on any other non-2xx. Keeps at least 1 000 ms between two calls to the same source.
  - `readRequiredSetting(source: SourceId, settingName: string): string` → `process.env[settingName]` or throws `SourceDisabledError`.

- [ ] **Step 1:** Delete the Playwright files, run `npm uninstall playwright`.
- [ ] **Step 2: Write the failing tests** with a fake `fetchFunction` returning `new Response(...)`: 200 JSON → parsed object; 404 → `null`; 403 → `SourceBlockedError` with `reason` `'http-403'`; 429 → `'http-429'`; 500 → plain `Error` whose message contains `500`; `readRequiredSetting('ebay', 'EBAY_CLIENT_ID')` with the variable unset → `SourceDisabledError`.
- [ ] **Step 3:** Run `npx vitest run tests/source-http`. Expected: FAIL, module not found.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit.

### Task 3: Cardmarket price guide

**Files:**
- Create: `src/price-sources/cardmarket/cardmarket-files.ts`, `src/price-sources/cardmarket/parse-cardmarket-price-guide.ts`, `src/price-sources/cardmarket/search-cardmarket-catalogue.ts`
- Test: `tests/price-sources/cardmarket/*.test.ts`, fixtures `tests/fixtures/cardmarket/price-guide-sample.json`, `tests/fixtures/cardmarket/nonsingles-sample.json` — trimmed slices of the real files (≈20 entries, including ids `798930`, `798931`, `798932` and one entry whose `avg`, `low` and `trend` are all null).

**Interfaces:**
- Consumes: Task 2 `requestSourceJson`.
- Produces:
  - `cardmarketFileUrls(gameId: number): { priceGuide: string; singles: string; nonSingles: string }` → `https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_<id>.json`, `.../productList/products_singles_<id>.json`, `.../productList/products_nonsingles_<id>.json`
  - `interface CardmarketCatalogueProduct { idProduct: number; name: string; categoryName: string; idExpansion: number }`
  - `interface SourceAggregate { source: PriceSourceId; sourceProductId: string; averageCents: number | null; lowCents: number | null; trendCents: number | null; average7DaysCents: number | null; average30DaysCents: number | null; observedAt: string }`
  - `parseCardmarketPriceGuide(rawGuide: unknown, observedAt: string): Map<number, SourceAggregate>` — euros × 100 rounded; null or 0 → null; entries with all of average/low/trend null are skipped.
  - `searchCardmarketCatalogue(products: CardmarketCatalogueProduct[], query: string, limit: number): CardmarketCatalogueProduct[]` — case- and accent-insensitive, every query word must appear in the name, shortest name first.

- [ ] **Step 1:** Build the two fixtures from the real files (download with `curl` into the job's temp dir, trim with a script, keep the real values).
- [ ] **Step 2: Write the failing tests:** id `798930` → `averageCents 15123`, `lowCents 8400`, `trendCents 14764`; the all-null entry is absent from the map; `searchCardmarketCatalogue(products, 'prismatic elite trainer', 5)[0].idProduct === 798930`; `'PRISMATIC ÉLITE'` finds the same product.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit.

### Task 4: eBay Browse API

**Files:**
- Create: `src/price-sources/ebay/ebay-access-token.ts`, `src/price-sources/ebay/parse-ebay-item-summaries.ts`, `src/price-sources/ebay/ebay-adapter.ts`
- Test: `tests/price-sources/ebay/*.test.ts`, fixture `tests/fixtures/ebay/item-summary-search.json` built from the documented response shape of `GET /buy/browse/v1/item_summary/search` (`itemSummaries[].{itemId,title,price{value,currency},condition,conditionId,itemWebUrl,image{imageUrl},shippingOptions[].shippingCost{value,currency}}`, `total`), replaced by a real capture once the keys exist.

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `fetchEbayAccessToken(fetchFunction?: FetchFunction): Promise<string>` — `POST https://api.ebay.com/identity/v1/oauth2/token`, Basic auth `base64(EBAY_CLIENT_ID:EBAY_CLIENT_SECRET)`, body `grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope`; caches the token until 60 s before `expires_in`.
  - `buildEbaySearchUrl(query: string, conditionIds: number[]): string` → `https://api.ebay.com/buy/browse/v1/item_summary/search?q=<query>&limit=100&filter=conditionIds:{1000|3000}` (filter omitted when the list is empty).
  - `parseEbayItemSummaries(rawSearch: unknown): ListingObservation[]` — kind `active`; `sourceCondition` = `condition`; shipping = first `shippingOptions` cost in EUR, else null; non-EUR dropped; deduplicated by URL.
  - `ebayAdapter: PriceSourceAdapter` with `supportedKinds: ['active']`, header `X-EBAY-C-MARKETPLACE-ID: EBAY_FR`.

- [ ] **Step 1: Write the failing tests:** fixture with 4 summaries (one in USD, one duplicated URL) → 2 observations; prices `6490` and `7200`; one `sourceCondition` `'Neuf'`; token request carries the Basic header and form body, second call within validity reuses the cached token (fake fetch called once); missing `EBAY_CLIENT_ID` → `SourceDisabledError`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 5: TCGdex and pokemontcg.io card prices

**Files:**
- Create: `src/price-sources/tcgdex/tcgdex-adapter.ts`, `src/price-sources/pokemontcg/pokemontcg-adapter.ts`, a parser file for each
- Test: `tests/price-sources/tcgdex/*.test.ts` with real fixtures (`GET https://api.tcgdex.net/v2/fr/cards?name=Dracaufeu` and `GET https://api.tcgdex.net/v2/fr/cards/sv08.5-161`); `tests/price-sources/pokemontcg/*.test.ts` with a fixture from the documented shape of `GET https://api.pokemontcg.io/v2/cards?q=name:"<name>"` (`data[].{id,name,set{name},images{small},cardmarket{prices{averageSellPrice,lowPrice,trendPrice,avg7,avg30}}}`). On this network `api.pokemontcg.io` is intercepted by a Sophos proxy: never disable TLS checks; the real capture happens from GitHub Actions or the server.

**Interfaces:**
- Consumes: Tasks 2 and 3 (`SourceAggregate`).
- Produces:
  - `interface CardCandidate { source: 'tcgdex' | 'pokemontcg'; sourceCardId: string; name: string; setName: string | null; imageUrl: string | null }`
  - `searchTcgdexCards(frenchName: string, fetchFunction?: FetchFunction): Promise<CardCandidate[]>`
  - `fetchTcgdexCardAggregate(cardId: string, fetchFunction?: FetchFunction): Promise<SourceAggregate | null>` — from `pricing.cardmarket`, `sourceProductId` = its `idProduct` (link to Cardmarket); null when `pricing.cardmarket` is null or `unit` is not `EUR`.
  - `searchPokemontcgCards(name: string, fetchFunction?: FetchFunction): Promise<CardCandidate[]>`, `fetchPokemontcgCardAggregate(cardId: string, fetchFunction?: FetchFunction): Promise<SourceAggregate | null>` — header `X-Api-Key` when `POKEMONTCG_API_KEY` is set (the API also answers without a key at a lower rate).

- [ ] **Step 1: Write the failing tests:** card `sv08.5-161` → `averageCents 101899`, `trendCents 91670`, `average7DaysCents 102337`, `sourceProductId '805555'`; search `Dracaufeu` → candidates all named `Dracaufeu`; the name `Dresseur d'Élite` is sent percent-encoded; pokemontcg fixture → aggregate from `cardmarket.prices`, `X-Api-Key` sent only when the variable is set.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 6: Identification sources — PSA, Open Beauty Facts, UPCitemdb

**Files:**
- Create: `src/identification-sources/identification-types.ts`, `src/identification-sources/psa-certificate.ts`, `src/identification-sources/open-beauty-facts.ts`, `src/identification-sources/upcitemdb.ts`
- Test: `tests/identification-sources/*.test.ts`; real fixtures for Open Beauty Facts (`GET https://world.openbeautyfacts.org/api/v2/product/<ean>.json?fields=product_name,brands,image_front_url`, one found, one `status: 0`) and UPCitemdb (`GET https://api.upcitemdb.com/prod/trial/lookup?upc=0820650853715`); PSA fixture from the documented shape of `GET https://api.psacard.com/publicapi/cert/GetByCertNumber/<cert>` (`PSACert.{CertNumber,Year,Brand,Subject,CardNumber,CardGrade,GradeDescription}`), replaced by a real capture once the token exists.

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `interface ProductIdentification { source: 'psa' | 'openbeautyfacts' | 'upcitemdb'; name: string; brand: string | null; imageUrl: string | null; barcode: string | null; gradingCompany: string | null; grade: string | null; certificateNumber: string | null }`
  - `lookupPsaCertificate(certificateNumber: string, fetchFunction?: FetchFunction): Promise<ProductIdentification | null>` — bearer `PSA_API_TOKEN`; `gradingCompany 'PSA'`, `grade` from `CardGrade`, `name` = `Year Brand Subject #CardNumber`.
  - `lookupOpenBeautyFacts(barcode: string, fetchFunction?: FetchFunction): Promise<ProductIdentification | null>` — null when `status` is 0.
  - `lookupUpcitemdb(barcode: string, fetchFunction?: FetchFunction): Promise<ProductIdentification | null>` — first item; null when `total` is 0.

- [ ] **Step 1: Write the failing tests:** UPCitemdb `0820650853715` → name starts with `Pokemon TCG: Paldea Evolved Build & Battle Box`; UPCitemdb 429 → `SourceBlockedError` reason `'http-429'`; Open Beauty Facts not found → null; PSA fixture → `grade` `'10'`, `gradingCompany` `'PSA'`, Authorization header `bearer <token>`; missing `PSA_API_TOKEN` → `SourceDisabledError`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 7: Probe CLI, CI workflow and findings

**Files:**
- Create: `src/probe/probe-references.ts`, `src/probe/run-probe.ts`, `src/probe/summarize-probe.ts`, `.github/workflows/probe-sources.yml`
- Modify: `docs/spikes/2026-11-02-price-sources.md`
- Test: `tests/probe/summarize-probe.test.ts`

**Interfaces:**
- Consumes: every adapter and lookup of Tasks 3-6.
- Produces:
  - `probeReferences`: eBay queries `['ETB Évolutions Prismatiques', 'Display Flammes Obsidiennes', 'PSA 10 Dracaufeu', 'Coffret maquillage', 'Lego Technic']`; Cardmarket ids `[798930, 798931]`; TCGdex card `sv08.5-161` and name `Dracaufeu`; pokemontcg name `Charizard`; UPCitemdb `0820650853715`; Open Beauty Facts `3600523307722`; PSA certificate from `PSA_PROBE_CERTIFICATE` when set.
  - `type ProbeOutcome = { source: SourceId; reference: string; status: 'ok' | 'disabled' | 'blocked' | 'error'; reason: string | null; resultCount: number; durationMs: number; sample: unknown[] }`
  - `summarizeProbe(outcomes: ProbeOutcome[]): { source: SourceId; okCount: number; disabledCount: number; blockedCount: number; errorCount: number }[]`
  - `npm run probe -- --label <local|github-actions|server>` loads `.env` when present (Node's `--env-file-if-exists`), writes `probe-reports/<label>-<ISO date>.json`, prints the summary.

- [ ] **Step 1: Write the failing tests:** `SourceDisabledError` → `disabled`, `SourceBlockedError` → `blocked`, never `ok`; an `ok` with 0 result counts in `okCount`; `sample` holds at most 3 entries.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; sources run sequentially.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Run `npm run probe -- --label local`. Expected: a report; sources without keys `disabled`; pokemontcg may be `error` (Sophos interception) on this network.
- [ ] **Step 6:** Workflow `probe-sources.yml`: `workflow_dispatch` only, `ubuntu-latest`, Node 22, `npm ci`, `npm test`, `npm run probe -- --label github-actions` with the four keys from repository secrets when set, artifact `probe-reports/` kept 14 days. Push, trigger once with `gh workflow run probe-sources.yml --ref <branch>`, check **once** with `gh run list --workflow probe-sources.yml --limit 1`; if still running, hand back instead of waiting.
- [ ] **Step 7:** Update the findings doc with a source × (local, GitHub Actions) table and each source's status. Commit and push.
