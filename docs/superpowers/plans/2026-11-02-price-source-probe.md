# Price Source Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one reusable adapter per price source (eBay, Vinted, Leboncoin, Cardmarket) and a probe that tells, from a home IP and from a datacenter IP (GitHub Actions), which sources answer and with what data.

**Architecture:** A standalone TypeScript package at the repository root (`src/price-sources/`), later imported by the Nuxt server in plan 3. Each adapter splits into a pure parser (HTML/JSON → observations, unit-tested on captured fixtures) and a thin Playwright fetcher. A CLI probe runs every adapter on reference queries and writes a JSON report; a manual GitHub Actions workflow runs the same probe from a datacenter IP.

**Tech Stack:** Node 22, TypeScript (ESM), `tsx`, `vitest`, `playwright` (Chromium), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-02-kairos-design.md` (sections 5 and 7, « Faisabilité des relevés »).

## Global Constraints

- Everything free: no paid API, proxy or service.
- French sites only: `www.ebay.fr`, `www.vinted.fr`, `www.leboncoin.fr`, `www.cardmarket.com/fr/Pokemon`.
- Always anonymous: never log in, never send a user's credentials or cookies.
- At least 2 000 ms between two requests to the same source.
- Prices stored as integer euro cents; any non-euro listing is dropped.
- No comment in the code; names reveal intent (no `data`, `temp`, `item`, `result`).
- No mention of any employer anywhere (code, User-Agent, commits). Git identity: `Nova686 <58865656+Nova686@users.noreply.github.com>` (already configured).
- Commit messages: one English sentence, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A captcha / anti-bot page answered with HTTP 200 must be reported `blocked`, never as « 0 listing ».
- A real search with no result must be reported `ok` with 0 listing, not `blocked`.
- French price formats: `1 234,56 €` (narrow no-break space U+202F or no-break space U+00A0), `12 €`, `12,00 €`, `EUR 12,00`, price ranges `10,00 € à 15,00 €` (take the lower bound).
- Listings without a usable price (« Prix sur demande », free, non-euro) are skipped, not counted as 0.
- Sponsored / duplicated cards (same URL twice) appear only once.

---

### Task 1: Package skeleton, shared types and euro price parsing

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` (`node_modules/`, `probe-reports/`, `.env`)
- Create: `src/price-sources/price-source-types.ts`
- Create: `src/price-sources/parse-euro-price.ts`
- Test: `tests/price-sources/parse-euro-price.test.ts`

**Interfaces:**
- Produces:
  - `type PriceSourceId = 'ebay' | 'vinted' | 'leboncoin' | 'cardmarket'`
  - `type ListingKind = 'active' | 'sold'`
  - `interface ListingObservation { source: PriceSourceId; kind: ListingKind; title: string; priceCents: number; shippingCents: number | null; sourceCondition: string | null; url: string; imageUrl: string | null }`
  - `interface PriceSourceAdapter { id: PriceSourceId; supportedKinds: ListingKind[]; search(query: string, kind: ListingKind): Promise<ListingObservation[]> }`
  - `class SourceBlockedError extends Error { constructor(source: PriceSourceId, reason: string) }`
  - `parseEuroPrice(displayedPrice: string): number | null`
  - `deduplicateByUrl(observations: ListingObservation[]): ListingObservation[]`

- [ ] **Step 1:** `package.json` with `"type": "module"`, scripts `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `probe` (`tsx src/probe/run-probe.ts`); devDependencies `typescript`, `tsx`, `vitest`, `@types/node`; dependency `playwright`. `tsconfig.json`: `strict`, `module`/`moduleResolution` `NodeNext`, `target` `ES2023`. Run `npm install`. Expected: lockfile created, no error.

- [ ] **Step 2: Write the failing tests** in `tests/price-sources/parse-euro-price.test.ts`:

```ts
it.each([
  ['12 €', 1200],
  ['12,00 €', 1200],
  ['1 234,56 €', 123456],
  ['1 234,56 €', 123456],
  ['EUR 12,00', 1200],
  ['10,00 € à 15,00 €', 1000],
])('parses %s', (displayedPrice, expectedCents) => {
  expect(parseEuroPrice(displayedPrice)).toBe(expectedCents)
})

it.each(['Prix sur demande', '$12.00', '12,00 £', '', 'Gratuit'])('rejects %s', (displayedPrice) => {
  expect(parseEuroPrice(displayedPrice)).toBeNull()
})

it('keeps one observation per url', () => {
  const observation = { source: 'ebay', kind: 'active', title: 'ETB', priceCents: 5000, shippingCents: null, sourceCondition: null, url: 'https://www.ebay.fr/itm/1', imageUrl: null } as const
  expect(deduplicateByUrl([observation, { ...observation, priceCents: 4000 }])).toHaveLength(1)
})
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 4:** Implement the types, `SourceBlockedError`, `parseEuroPrice` (requires `€` or `EUR`; normalises U+00A0 / U+202F / spaces; lower bound of a range) and `deduplicateByUrl` (keeps the first occurrence).
- [ ] **Step 5:** Run `npm test && npm run typecheck`. Expected: PASS, no type error.
- [ ] **Step 6:** Commit `package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src tests`.

### Task 2: Playwright page loader with block detection

**Files:**
- Create: `src/price-sources/browser/open-source-page.ts`
- Create: `src/price-sources/browser/detect-anti-bot-page.ts`
- Test: `tests/price-sources/detect-anti-bot-page.test.ts`, fixtures `tests/fixtures/anti-bot/*.html`

**Interfaces:**
- Consumes: `PriceSourceId`, `SourceBlockedError` (Task 1).
- Produces:
  - `detectAntiBotPage(httpStatus: number, html: string): string | null` → returns the reason (`'http-403'`, `'datadome'`, `'cloudflare-challenge'`, `'captcha'`) or `null`.
  - `withSourcePage<T>(source: PriceSourceId, url: string, readPage: (page: Page) => Promise<T>): Promise<T>` → launches a shared headless Chromium (locale `fr-FR`, timezone `Europe/Paris`), waits until the per-source 2 000 ms spacing is respected, navigates, throws `SourceBlockedError` when `detectAntiBotPage` returns a reason, else runs `readPage`.
  - `closeSourceBrowser(): Promise<void>`

- [ ] **Step 1: Write the failing tests:** 403 → `'http-403'`; 200 with an HTML containing `captcha-delivery.com` → `'datadome'`; 200 with `cf-chl` / `Just a moment...` → `'cloudflare-challenge'`; 200 with a normal results page fixture → `null`. Fixtures are minimal hand-written HTML snippets holding those markers.
- [ ] **Step 2:** Run `npx vitest run tests/price-sources/detect-anti-bot-page.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement both files; `withSourcePage` is not unit-tested (network), it is exercised by the probe.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Tasks 3 to 6: One adapter per source

Each of the four tasks follows the same cycle; the per-source table fixes what differs.

**Files (per source `<source>`):**
- Create: `src/price-sources/<source>/<source>-search-url.ts`, `src/price-sources/<source>/parse-<source>-results.ts`, `src/price-sources/<source>/<source>-adapter.ts`
- Create: `scripts/capture-fixture.ts` (Task 3 only; reused afterwards): `tsx scripts/capture-fixture.ts <source> <kind> "<query>"` saves the raw page (HTML or JSON) to `tests/fixtures/<source>/<kind>.<ext>` through `withSourcePage`.
- Test: `tests/price-sources/<source>/parse-<source>-results.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `parseEuroPrice`, `deduplicateByUrl`; Task 2 `withSourcePage`.
- Produces: `build<Source>SearchUrl(query: string, kind: ListingKind): string`, `parse<Source>Results(rawPage: string, kind: ListingKind): ListingObservation[]`, `export const <source>Adapter: PriceSourceAdapter`.

| Task | Source | Kinds | Where the listings are | `sourceCondition` taken from | URL check in tests |
|---|---|---|---|---|---|
| 3 | eBay | `active`, `sold` | `https://www.ebay.fr/sch/i.html?_nkw=<q>`; sold adds `&LH_Sold=1&LH_Complete=1` | the condition line of each card (« Neuf », « Occasion »…) | starts with `https://www.ebay.fr/itm/` |
| 4 | Vinted | `active` | homepage first (session cookie), then `https://www.vinted.fr/api/v2/catalog/items?search_text=<q>&per_page=96` fetched from the page context; raw page = JSON | `status` field (« Neuf avec étiquette »…) | starts with `https://www.vinted.fr/items/` |
| 5 | Leboncoin | `active` | `https://www.leboncoin.fr/recherche?text=<q>`; JSON of the `__NEXT_DATA__` script | `item_condition` / `condition` attribute when present, else `null` | starts with `https://www.leboncoin.fr/` |
| 6 | Cardmarket | `active` | search `https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=<q>`, first product, then its offers list | the condition badge of each offer, `null` for sealed | starts with `https://www.cardmarket.com/fr/Pokemon/Products/` |

- [ ] **Step 1:** Capture the fixtures for each kind with the query `ETB Évolutions Prismatiques`, plus an empty-result fixture with the query `zzqxkairosaucunresultat`. If the capture is blocked from the home IP, record it, write the parser from the source's public page structure using a hand-built fixture, and flag the source in the probe report notes.
- [ ] **Step 2: Write the failing tests:**

```ts
it('reads the listings of a real results page', () => {
  const observations = parseVintedResults(readFixture('vinted/active.json'), 'active')
  expect(observations.length).toBeGreaterThanOrEqual(10)
  for (const observation of observations) {
    expect(observation.source).toBe('vinted')
    expect(observation.kind).toBe('active')
    expect(observation.priceCents).toBeGreaterThan(0)
    expect(observation.url.startsWith('https://www.vinted.fr/items/')).toBe(true)
    expect(observation.title.length).toBeGreaterThan(0)
  }
  expect(new Set(observations.map((observation) => observation.url)).size).toBe(observations.length)
})

it('returns no listing for an empty search', () => {
  expect(parseVintedResults(readFixture('vinted/empty.json'), 'active')).toEqual([])
})
```

  Plus, per source: at least one observation has a non-null `sourceCondition` (except Cardmarket sealed); for eBay `sold`, the parser skips the first placeholder card eBay inserts (« Shop on eBay »).
- [ ] **Step 3:** Run the source's test file. Expected: FAIL.
- [ ] **Step 4:** Implement URL builder, parser and adapter. Selectors are the builder's call.
- [ ] **Step 5:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit the source's files and fixtures.

### Task 7: Probe CLI and report

**Files:**
- Create: `src/probe/probe-queries.ts`, `src/probe/run-probe.ts`, `src/probe/summarize-probe.ts`
- Test: `tests/probe/summarize-probe.test.ts`

**Interfaces:**
- Consumes: the four adapters (Tasks 3-6), `closeSourceBrowser` (Task 2).
- Produces:
  - `const probeQueries = ['ETB Évolutions Prismatiques', 'Display Flammes Obsidiennes', 'PSA 10 Dracaufeu', 'Coffret maquillage Sephora', 'Lego Technic 42143']`
  - `type ProbeOutcome = { source: PriceSourceId; kind: ListingKind; query: string; status: 'ok' | 'blocked' | 'error'; reason: string | null; listingCount: number; durationMs: number; sample: ListingObservation[] }`
  - `summarizeProbe(outcomes: ProbeOutcome[]): { source: PriceSourceId; kind: ListingKind; okCount: number; blockedCount: number; errorCount: number; medianListingCount: number }[]`
  - `npm run probe -- --label <home|github-actions|oracle>` writes `probe-reports/<label>-<ISO date>.json` (outcomes + summary + Node version + public IP from `https://api.ipify.org`) and prints the summary as a table.

- [ ] **Step 1: Write the failing tests:** a `SourceBlockedError` outcome counts in `blockedCount`, never in `okCount`; an `ok` outcome with 0 listing counts in `okCount`; `medianListingCount` of `[3, 10, 50]` is `10`; `sample` holds at most 3 observations.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `run-probe.ts` runs sources sequentially, each query × each supported kind, catches `SourceBlockedError` → `blocked`, any other error → `error` with its message.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Run `npm run probe -- --label home`. Expected: a report file and a table with one row per source × kind.
- [ ] **Step 6:** Commit (reports stay out of git).

### Task 8: Datacenter run on GitHub Actions and findings

**Files:**
- Create: `.github/workflows/probe-price-sources.yml`
- Create: `docs/spikes/2026-11-02-price-sources.md`

- [ ] **Step 1:** Workflow triggered by `workflow_dispatch` only, `ubuntu-latest`, Node 22, `npm ci`, `npx playwright install --with-deps chromium`, `npm test`, `npm run probe -- --label github-actions`, upload `probe-reports/` as an artifact (retention 14 days).
- [ ] **Step 2:** Commit, push the branch, run it once: `gh workflow run probe-price-sources.yml --ref <branch>`, then check it **once** with `gh run list --workflow probe-price-sources.yml --limit 1`; if it is still running, hand back to the user instead of waiting. Download the artifact with `gh run download`.
- [ ] **Step 3:** Write `docs/spikes/2026-11-02-price-sources.md`, in French: a table with source × kind × (home IP, GitHub Actions IP) → status and median listing count, the observed conditions vocabulary per source, and the recommendation per source among the spec's fallbacks (VM, official free API, site JSON, GitHub Actions, disabled). The Oracle column stays « à mesurer » until plan 5 provides the VM.
- [ ] **Step 4:** Commit and push.
