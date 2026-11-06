# Application Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Kairos web app where invited users sign in and manage their own stock: shared catalogue with its change journal, items with condition and location, purchases and sales (lots, fees, shipping), deliveries, people and debts, and product search by text.

**Architecture:** Nuxt 4 full-stack app at the repository root, next to the existing `src/` source adapters (plan 1). `app/` holds pages and components, `server/` holds the API, the database and the domain services, `shared/` holds types and the condition scale used on both sides. Domain services are plain functions taking a Drizzle database as first argument, so they are tested against an in-process PGlite database; API handlers stay thin (session → validation → service). The database driver is chosen by URL: `pglite://…` (tests, local dev, no Docker) or `postgres://…` (server).

**Tech Stack:** Nuxt 4.6, Vue 3, Vuetify 4 (`vite-plugin-vuetify`), `nuxt-auth-utils` 0.6, Drizzle ORM 0.45 + drizzle-kit, `@electric-sql/pglite` 0.5, `postgres` 4, `zod`, Vitest, `@nuxt/test-utils` 4, `@nuxt/eslint`.

**Spec:** `docs/superpowers/specs/2026-11-02-kairos-design.md` (objectives 1, 2 « texte libre », 7 to 13; sections 8 and 9). Plan 1 (`2026-11-02-price-source-probe.md`) provides the source adapters under `src/`.

## Global Constraints

- French UI, euro amounts stored as integer cents everywhere; displayed with `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
- Every user-owned row carries `ownerId`; every read and write of such a row filters on the session user. Another user's row answers **404**, never 403, so existence is not leaked.
- Catalogue, barcodes and change journal are shared by all users; every catalogue write appends a journal entry.
- Free only: no paid service, no new external API beyond plan 1's.
- No comment in the code; names reveal intent (no `data`, `temp`, `item`, `result`); the word `item` is reserved for the domain entity « exemplaire » and always appears as `stockItem` in code to stay unambiguous.
- Dependencies limited to the stack above plus `@mdi/font`; anything else needs a ruling.
- `npm test`, `npm run typecheck` and `npm run lint` green at the end of every task.
- Git identity `Nova686 <58865656+Nova686@users.noreply.github.com>`; one-sentence English commit messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never commit `.env` nor `.data/`.

## Review Focus

- A user reaching another user's item, purchase, sale, location, person or debt by id (GET, PATCH, DELETE) gets 404 and nothing changes.
- Lot allocations always sum exactly to the total (e.g. 100,00 € over 3 items → 33,34 + 33,33 + 33,33), including totals of 0 and 1 cent.
- A sale's net profit when the shipping is **not** included: the shipping cost is not deducted; when included, it is.
- Deleting a sale returns its items to `in_stock`; deleting a purchase with a sold item is refused (409).
- An invitation code is single-use and expires after 7 days; reusing it fails without creating a user.

---

## Shared definitions (referenced by every task)

**Categories** (`shared/catalogue/product-category.ts`): `type ProductCategory = 'pokemon-sealed' | 'graded-card' | 'toy' | 'makeup' | 'other'` with French labels `Pokémon scellé`, `Carte gradée`, `Jouet`, `Maquillage`, `Autre`.

**Condition scale** (`shared/catalogue/condition-scale.ts`), from the spec:

| Category | Codes (in order, best first) | Labels |
|---|---|---|
| `pokemon-sealed` | `sealed-new`, `sealed-damaged-box`, `opened-complete`, `opened-incomplete` | neuf scellé, neuf boîte abîmée, ouvert complet, ouvert incomplet |
| `toy`, `makeup`, `other` | `new-with-tags`, `new-without-tags`, `very-good`, `good`, `satisfactory` | neuf avec étiquette / emballage, neuf sans étiquette, très bon état, bon état, état satisfaisant |
| `graded-card` | `graded` | gradée (the real condition is `gradingCompany` + `grade` on the item) |

Produces `conditionCodesFor(category: ProductCategory): ConditionCode[]`, `conditionLabel(code: ConditionCode): string`, `isConditionAllowed(category, code): boolean`.

**Item statuses** (`shared/stock/stock-item-status.ts`): `'in-transit' | 'in-stock' | 'sold-in-transit' | 'sold'`, labels `en livraison`, `en stock`, `vendu – en livraison`, `vendu`.

**Allocation** (`shared/money/allocate-cents.ts`): `allocateCents(totalCents: number, weights: number[]): number[]` — largest remainder: each share is `floor(total × weight / sum)`, the leftover cents go one by one to the largest fractional parts, ties to the lowest index; all weights 0 → equal weights. Throws on an empty list or a negative total.

**Sale profit** (`shared/money/sale-profit.ts`): for one sale, `saleNetCents = totalPriceCents − platformFeesCents − packagingCostCents − (shippingIncluded ? shippingCostCents : 0)`; each sold item gets `allocatedSaleCents` from `allocateCents(saleNetCents, its weights)` and `netProfitCents = allocatedSaleCents − allocatedPurchaseCents`. Weights are the items' `allocatedPurchaseCents` in this plan; plan 3 switches the default to estimated value.

---

### Task 1: Nuxt 4 + Vuetify scaffold, test projects and app shell

**Files:**
- Modify: `package.json` (scripts `dev`, `build`, `preview`, `postinstall: nuxt prepare`, `test`, `typecheck: nuxt typecheck`, `lint: eslint .`, `lint:fix`), `tsconfig.json` (extends `./.nuxt/tsconfig.json` references; keeps `src/` and `tests/` included), `vitest.config.ts` (projects `unit` = `tests/unit/**`, `tests/price-sources/**`, `tests/identification-sources/**`, `tests/source-http/**`, `tests/probe/**`, node env; `e2e` = `tests/e2e/**` with `@nuxt/test-utils`), `.gitignore` (+ `.nuxt/`, `.output/`, `.data/`)
- Move: existing tests stay where they are (they are matched by the `unit` project).
- Create: `nuxt.config.ts`, `eslint.config.mjs`, `app/app.vue`, `app/plugins/vuetify.ts`, `app/layouts/default.vue`, `app/pages/index.vue`, `app/components/navigation/MainNavigation.vue`
- Test: `tests/e2e/app-shell.test.ts`

**Interfaces:**
- Produces: navigation entries `Tableau de bord /`, `Stock /stock`, `Ajouter /ajouter`, `Ventes /ventes`, `Livraisons /livraisons`, `Dettes /dettes`, `Lieux /lieux`, `Personnes /personnes`, `Réglages /reglages`; layout = Vuetify `v-navigation-drawer` (rail on desktop, temporary on phone via `useDisplay().mobile`) + `v-app-bar` titled « Kairos »; theme colours defined once in the plugin.

- [ ] **Step 1:** Install `nuxt@^4.6`, `vue`, `vuetify@^4.3`, `vite-plugin-vuetify`, `@mdi/font`, `@nuxt/eslint`, `@nuxt/test-utils`, `@vue/test-utils`, `happy-dom`. Vuetify is wired manually (Vuetify docs « Nuxt » manual setup): `build.transpile: ['vuetify']`, the Vite plugin with `autoImport: true`, a client+server plugin creating the instance with `ssr: true`, French locale (`vuetify/locale` `fr`).
- [ ] **Step 2: Write the failing test** `tests/e2e/app-shell.test.ts` with `await setup({ server: true })`: `GET /` returns HTML containing `Kairos` and `Stock`.
- [ ] **Step 3:** Run `npx vitest run --project e2e`. Expected: FAIL (no app).
- [ ] **Step 4:** Implement the shell.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run lint`. Expected: all green, plan 1's 55 tests still pass.
- [ ] **Step 6:** Commit.

### Task 2: Database schema, driver and test database

**Files:**
- Create: `drizzle.config.ts`, `server/database/schema/accounts.ts`, `server/database/schema/catalogue.ts`, `server/database/schema/stock.ts`, `server/database/schema/sales.ts`, `server/database/schema/debts.ts`, `server/database/schema/index.ts`, `server/database/migrations/*` (generated), `server/database/open-database.ts`, `server/utils/use-database.ts`, `tests/support/create-test-database.ts`
- Test: `tests/unit/database/schema.test.ts`

**Interfaces:**
- Produces: tables (all ids `uuid` default `gen_random_uuid()`, timestamps `timestamptz` default `now()`):
  - `users(id, email unique, displayName, passwordHash, isAdmin bool default false, createdAt)`
  - `invitations(id, code unique, createdByUserId → users, usedByUserId → users null, expiresAt, usedAt null, createdAt)`
  - `products(id, name, category, productType null, seriesName null, language null, imageUrl null, cardmarketProductId int null, tcgdexCardId null, pokemontcgCardId null, ebayQuery null, ebayExcludedKeywords text[] default '{}', createdByUserId, createdAt, updatedAt)`
  - `productBarcodes(barcode pk, productId → products, createdByUserId, createdAt)`
  - `catalogueChanges(id, productId → products, userId → users, fieldName, previousValue jsonb, newValue jsonb, revertedChangeId null, changedAt)`
  - `cardmarketProducts(idProduct pk, name, categoryName, idExpansion, refreshedAt)`
  - `locations(id, ownerId, label, createdAt)` unique `(ownerId, label)`
  - `persons(id, ownerId, name, createdAt)`
  - `purchases(id, ownerId, purchasedOn date, sellerLabel null, totalPriceCents, feesCents default 0, trackingReference null, createdAt)`
  - `stockItems(id, ownerId, productId → products, purchaseId → purchases, condition, gradingCompany null, grade null, certificateNumber null, allocatedPurchaseCents, locationId → locations null, status, notes null, receivedOn date null, createdAt)`
  - `sales(id, ownerId, soldOn date, platform, buyerPersonId → persons null, totalPriceCents, shippingIncluded bool, shippingCostCents default 0, platformFeesCents default 0, packagingCostCents default 0, trackingReference null, deliveredOn date null, createdAt)`
  - `saleItems(saleId → sales, stockItemId → stockItems unique, allocatedSaleCents)` pk `(saleId, stockItemId)`
  - `debts(id, ownerId, personId → persons, amountCents, direction 'owed-to-me' | 'i-owe', reason, purchaseId null, saleId null, stockItemId null, createdOn date, settledOn date null)`
  - Foreign keys are `restrict` on delete (no cascade); deletions are explicit in services.
- `openDatabase(databaseUrl: string): Promise<KairosDatabase>` — `pglite://memory` → in-memory PGlite, `pglite://<path>` → file PGlite, otherwise `postgres` driver; runs pending migrations on open.
- `useDatabase(): Promise<KairosDatabase>` — singleton from `runtimeConfig.databaseUrl` (env `NUXT_DATABASE_URL`, default `pglite://.data/kairos`).
- `createTestDatabase(): Promise<KairosDatabase>` — fresh in-memory database with migrations applied.
- `type KairosDatabase` exported from `server/database/open-database.ts`.

- [ ] **Step 1: Write the failing tests:** `createTestDatabase()` creates every table above (query `information_schema.tables`); inserting two locations with the same `(ownerId, label)` fails; deleting a product referenced by a stock item fails.
- [ ] **Step 2:** Run `npx vitest run tests/unit/database`. Expected: FAIL.
- [ ] **Step 3:** Write the schema, `npx drizzle-kit generate`, implement the driver and helpers.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5:** Commit (schema, migrations, helpers, tests).

### Task 3: Accounts, sessions and invitations

**Files:**
- Create: `server/domain/accounts/accounts-service.ts`, `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/api/auth/me.get.ts`, `server/api/invitations/index.post.ts`, `server/api/invitations/[code].get.ts`, `server/api/invitations/[code]/accept.post.ts`, `server/utils/require-session-user.ts`, `server/middleware/require-authentication.ts`, `scripts/create-admin.ts`, `app/pages/connexion.vue`, `app/pages/invitation/[code].vue`, `app/pages/reglages.vue`, `app/middleware/authenticated.global.ts`
- Test: `tests/unit/accounts/accounts-service.test.ts`, `tests/e2e/authentication.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `createUser(database, { email, displayName, password, isAdmin }): Promise<SessionUser>` (email lower-cased, password ≥ 10 chars, hashed with `hashPassword` from `nuxt-auth-utils`)
  - `verifyCredentials(database, email, password): Promise<SessionUser | null>`
  - `createInvitation(database, createdByUserId): Promise<{ code: string; expiresAt: Date }>` — code = 24 random URL-safe chars, valid 7 days, admin only (checked in the handler)
  - `acceptInvitation(database, code, { email, displayName, password }): Promise<SessionUser>` — throws `InvitationUnavailableError` when unknown, used or expired; marks it used in the same transaction
  - `type SessionUser = { id: string; email: string; displayName: string; isAdmin: boolean }`
  - `requireSessionUser(event): Promise<SessionUser>` (401 otherwise)
  - Server middleware: every `/api/**` except `/api/auth/login`, `/api/invitations/:code` (GET) and `/api/invitations/:code/accept` answers 401 without session.
  - `npm run create-admin -- <email> <displayName>` reads the password from stdin, creates the first admin.
  - Settings page: create an invitation (admin), shows the link `<origin>/invitation/<code>`, copy button.

- [ ] **Step 1: Write the failing tests:** accept a fresh invitation → user exists, invitation `usedAt` set; second accept of the same code → `InvitationUnavailableError` and still one user; expired code (fake `expiresAt` in the past) → error; `verifyCredentials` with a wrong password → null; e2e: `GET /api/auth/me` without cookie → 401, login then `me` → the user.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement services, handlers (`zod` validation via `readValidatedBody`), pages (Vuetify forms, French errors).
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 4: Ownership guard, locations and persons

**Files:**
- Create: `server/domain/ownership/find-owned-or-404.ts`, `server/domain/locations/locations-service.ts`, `server/domain/persons/persons-service.ts`, `server/api/locations/*`, `server/api/persons/*`, `app/pages/lieux.vue`, `app/pages/personnes.vue`, `app/composables/useOwnedCollection.ts`
- Test: `tests/unit/locations/locations-service.test.ts`, `tests/unit/persons/persons-service.test.ts`, `tests/e2e/ownership.test.ts`

**Interfaces:**
- Produces:
  - `findOwnedOr404<TTable>(database, table, id: string, ownerId: string)` → the row or throws `createError({ statusCode: 404 })`.
  - Locations: `listLocations(database, ownerId)`, `createLocation(database, ownerId, label)` (trimmed, non-empty, unique per owner → 409), `renameLocation(database, ownerId, locationId, label)`, `deleteLocation(database, ownerId, locationId)` (refused 409 while an item uses it).
  - Persons: `listPersons`, `createPerson`, `renamePerson`, `deletePerson` (refused 409 while a debt or sale references it).
  - `useOwnedCollection<TRow>(endpoint: string)` → `{ rows, refresh, createRow, updateRow, deleteRow, pending, errorMessage }` built on `useFetch` / `$fetch`.

- [ ] **Step 1: Write the failing tests:** duplicate label → 409; delete a used location → 409; e2e with two users: B `PATCH /api/locations/<A's id>` → 404 and A's label unchanged; B's `GET /api/locations` does not contain A's rows.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 5: Shared catalogue, change journal and text search

**Files:**
- Create: `shared/catalogue/product-category.ts`, `shared/catalogue/condition-scale.ts`, `server/domain/catalogue/catalogue-service.ts`, `server/domain/catalogue/catalogue-journal.ts`, `server/domain/catalogue/search-product-candidates.ts`, `server/domain/catalogue/refresh-cardmarket-products.ts`, `server/tasks/catalogue/refresh-cardmarket-products.ts`, `server/api/products/*`, `server/api/products/[id]/changes.get.ts`, `server/api/catalogue-changes/[id]/revert.post.ts`, `server/api/catalogue/search.get.ts`, `server/api/barcodes/[barcode].get.ts`
- Test: `tests/unit/catalogue/*.test.ts`

**Interfaces:**
- Consumes: plan 1 `downloadCardmarketSealedProducts`, `searchCardmarketCatalogue`, `searchTcgdexCards`, `searchEbayListings`, `SourceDisabledError`, `SourceBlockedError`.
- Produces:
  - `createProduct(database, userId, draft: ProductDraft): Promise<Product>` — journal entry `fieldName '*'`, `previousValue null`.
  - `updateProduct(database, userId, productId, changes: Partial<ProductDraft>): Promise<Product>` — one journal entry per changed field, none for unchanged values.
  - `revertCatalogueChange(database, userId, changeId): Promise<Product>` — restores `previousValue`, journals the revert with `revertedChangeId`.
  - `attachBarcode(database, userId, productId, barcode)` — barcode already linked to another product → 409; `findProductByBarcode(database, barcode)`.
  - `refreshCardmarketProducts(database, fetchFunction?)` — upserts the sealed catalogue (game 6); Nitro task `catalogue:refresh-cardmarket-products`, scheduled daily at 04:00 (`nitro.scheduledTasks: { '0 4 * * *': [...] }`, `nitro.experimental.tasks: true`), also run once when the table is empty.
  - `type ProductCandidate = { origin: 'catalogue' | 'cardmarket' | 'tcgdex' | 'ebay'; label: string; imageUrl: string | null; productId: string | null; draft: ProductDraft }`
  - `searchProductCandidates(database, query, dependencies?): Promise<{ candidates: ProductCandidate[]; unavailableSources: string[] }>` — order: catalogue (name contains every word, accent-insensitive, max 10), Cardmarket sealed (max 10, draft category `pokemon-sealed`, `cardmarketProductId` set), TCGdex (max 10, draft category `graded-card`, `tcgdexCardId` set), eBay (max 10 distinct titles, category `other`); a disabled or blocked source lands in `unavailableSources`, never fails the search; candidates already in the catalogue (same `cardmarketProductId` / `tcgdexCardId`) appear once, as `catalogue`.

- [ ] **Step 1: Write the failing tests** (sources injected as fakes): update of 2 fields → 2 journal entries; revert restores the old name and adds an entry; barcode conflict → 409; search with eBay disabled returns catalogue + Cardmarket candidates and `unavailableSources: ['ebay']`; a Cardmarket candidate already in the catalogue appears once; `isConditionAllowed('pokemon-sealed', 'good') === false`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 6: Items, purchases and deliveries in

**Files:**
- Create: `shared/money/allocate-cents.ts`, `shared/stock/stock-item-status.ts`, `server/domain/stock/purchases-service.ts`, `server/domain/stock/stock-items-service.ts`, `server/api/purchases/*`, `server/api/stock-items/*`, `server/api/stock-items/[id]/receive.post.ts`
- Test: `tests/unit/money/allocate-cents.test.ts`, `tests/unit/stock/*.test.ts`

**Interfaces:**
- Produces:
  - `allocateCents` (see Shared definitions).
  - `type PurchaseDraft = { purchasedOn: string; sellerLabel: string | null; totalPriceCents: number; feesCents: number; trackingReference: string | null; inTransit: boolean; lines: { productId: string; condition: ConditionCode; gradingCompany: string | null; grade: string | null; certificateNumber: string | null; locationId: string | null; allocatedPurchaseCents: number | null }[] }`
  - `createPurchase(database, ownerId, draft): Promise<{ purchase; stockItems }>` — one stock item per line; when every `allocatedPurchaseCents` is null, `totalPriceCents + feesCents` is split with `allocateCents` (equal weights); when all are given they must sum to `totalPriceCents + feesCents` (else 422); mixing given and null → 422; condition checked with `isConditionAllowed`; status `in-transit` when `inTransit`, else `in-stock` with `receivedOn = purchasedOn`; owned location required.
  - `receiveStockItem(database, ownerId, stockItemId, receivedOn)` — `in-transit` → `in-stock`; other status → 409.
  - `updateStockItem(database, ownerId, stockItemId, changes: { condition?, locationId?, notes?, gradingCompany?, grade?, certificateNumber? })`
  - `deletePurchase(database, ownerId, purchaseId)` — refused 409 when one of its items is sold or in a sale; otherwise deletes items then purchase.
  - `listStockItems(database, ownerId, filters: { status?: StockItemStatus[]; category?: ProductCategory; locationId?: string; search?: string })` — joined with product name, image, category.

- [ ] **Step 1: Write the failing tests:** `allocateCents(10000, [1,1,1])` → `[3334, 3333, 3333]`; `allocateCents(1, [1,1])` → `[1, 0]`; `allocateCents(0, [2,1])` → `[0, 0]`; `allocateCents(1000, [0,0])` → `[500, 500]`; sum always equals total for 200 random cases; purchase of 3 lines at 100,00 € + 4,50 € fees → items 3484 + 3483 + 3483; condition `good` on a sealed product → 422; receive twice → 409; delete purchase with a sold item → 409.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 7: Sales, fees and deliveries out

**Files:**
- Create: `shared/money/sale-profit.ts`, `server/domain/sales/sales-service.ts`, `server/api/sales/*`, `server/api/sales/[id]/delivered.post.ts`
- Test: `tests/unit/money/sale-profit.test.ts`, `tests/unit/sales/sales-service.test.ts`

**Interfaces:**
- Consumes: Task 6.
- Produces:
  - `computeSaleNetCents(sale: Pick<Sale, 'totalPriceCents' | 'platformFeesCents' | 'packagingCostCents' | 'shippingIncluded' | 'shippingCostCents'>): number`
  - `type SaleDraft = { soldOn; platform; buyerPersonId: string | null; totalPriceCents; shippingIncluded: boolean; shippingCostCents; platformFeesCents; packagingCostCents; trackingReference: string | null; stockItemIds: string[] }`
  - `createSale(database, ownerId, draft): Promise<{ sale; saleItems }>` — items must be owned and `in-stock` (else 409); allocation per Shared definitions; items become `sold-in-transit` when `trackingReference` is set, else `sold`.
  - `markSaleDelivered(database, ownerId, saleId, deliveredOn)` — items `sold-in-transit` → `sold`.
  - `deleteSale(database, ownerId, saleId)` — items back to `in-stock`, sale rows removed, linked unsettled debts removed, settled ones refuse (409).
  - `listSales(database, ownerId)` — each sale with its items, `saleNetCents`, `netProfitCents` (sum of items).

- [ ] **Step 1: Write the failing tests:** sale 100,00 €, fees 8,00 €, packaging 1,00 €, shipping 6,00 € included → net 8500; same but not included → net 9100; a lot of 2 items bought 30,00 € and 10,00 € sold 80,00 € net → allocated 6000 / 2000, profit 3000 / 1000; selling an `in-transit` item → 409; delete sale → items `in-stock`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 8: Debts

**Files:**
- Create: `server/domain/debts/debts-service.ts`, `server/api/debts/*`, `server/api/debts/[id]/settle.post.ts`, `server/api/debts/balances.get.ts`
- Test: `tests/unit/debts/debts-service.test.ts`

**Interfaces:**
- Produces:
  - `createDebt(database, ownerId, draft: { personId; amountCents > 0; direction; reason; purchaseId?; saleId?; stockItemId?; createdOn })` — linked purchase/sale/item and person must be owned.
  - `settleDebt(database, ownerId, debtId, settledOn)`; settling twice → 409.
  - `listDebts(database, ownerId, { settled?: boolean })`
  - `computeDebtBalances(database, ownerId): Promise<{ personId; personName; owedToMeCents; iOweCents; balanceCents }[]>` — unsettled only, `balanceCents = owedToMeCents − iOweCents`, sorted by absolute balance descending, persons with no open debt omitted.
  - Sale creation form offers « vente pas encore payée » → creates an `owed-to-me` debt for the buyer; purchase form offers « avancé par » → creates an `i-owe` debt (both through `createDebt`, from the UI in Task 9/10).

- [ ] **Step 1: Write the failing tests:** two open debts 20,00 € owed to me and 5,00 € I owe to the same person → balance 1500; a settled debt is excluded; settle twice → 409; linking another user's sale → 404.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 9: Stock and add-product screens

**Files:**
- Create: `app/pages/stock/index.vue`, `app/pages/stock/[id].vue`, `app/pages/ajouter.vue`, `app/components/stock/StockItemList.vue`, `app/components/stock/StockFilters.vue`, `app/components/catalogue/ProductCandidatePicker.vue`, `app/components/stock/PurchaseForm.vue`, `app/components/common/MoneyField.vue`, `app/composables/useStockItems.ts`, `app/composables/useProductSearch.ts`, `app/utils/format-euros.ts`
- Test: `tests/unit/format/format-euros.test.ts`, `tests/e2e/add-purchase-flow.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 6, 8.
- Produces:
  - `formatEuros(cents: number): string` (`'1 234,56 €'` with the narrow no-break space Intl produces) and `parseEuroInput(typed: string): number | null` (accepts `12`, `12,5`, `12,50`, `12.50`, `1 234,56`).
  - Stock page: filters (status, category, location, text), list with image, name, condition label, location, purchase price; phone layout = cards, desktop = `v-data-table`.
  - Add page: text field → `useProductSearch` (debounced 400 ms) → candidates grouped by origin, unavailable sources shown as a muted line « eBay indisponible : clés manquantes » → pick or « Créer un produit » → `PurchaseForm` (lines with condition select restricted by category, grading fields for `graded-card`, location select, lot total + fees, « en livraison » switch with tracking reference, « avancé par » person + amount).
  - Item page: details, edit condition/location/notes, receive button when in transit, journal of the product.

- [ ] **Step 1: Write the failing tests:** `parseEuroInput('1 234,56') === 123456`, `parseEuroInput('12,5') === 1250`, `parseEuroInput('abc') === null`; e2e: logged-in user posts a 2-line purchase through the API used by the page, then `GET /stock` HTML lists both product names.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement components following `nuxt:vue-component-structure` (logic in composables).
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 10: Sales, deliveries, debts and people screens

**Files:**
- Create: `app/pages/ventes/index.vue`, `app/pages/ventes/nouvelle.vue`, `app/pages/livraisons.vue`, `app/pages/dettes.vue`, `app/components/sales/SaleForm.vue`, `app/components/sales/SaleList.vue`, `app/components/deliveries/DeliveryList.vue`, `app/components/debts/DebtBalances.vue`, `app/components/debts/DebtForm.vue`, `app/composables/useSales.ts`, `app/composables/useDeliveries.ts`, `app/composables/useDebts.ts`, `server/api/deliveries.get.ts`, `server/domain/deliveries/list-deliveries.ts`
- Test: `tests/unit/deliveries/list-deliveries.test.ts`, `tests/e2e/sale-flow.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 7, 8.
- Produces:
  - `listDeliveries(database, ownerId): Promise<{ incoming: { stockItemId; productName; trackingReference; purchasedOn }[]; outgoing: { saleId; productNames: string[]; trackingReference; soldOn }[] }>`; tracking references starting with `http` render as links, others as copyable text.
  - Sale form: multi-select of `in-stock` items, total, « port inclus » switch, shipping/fees/packaging, platform (free text with suggestions Vinted, eBay, Leboncoin, Cardmarket, Main propre), buyer person, « pas encore payé » → debt; live net and profit preview using `computeSaleNetCents` and `allocateCents`.
  - Debts page: balances per person on top, open debts list with « Réglé » action, settled history collapsed.

- [ ] **Step 1: Write the failing tests:** an in-transit purchase and a sale with tracking appear in `incoming` / `outgoing`; after `receive` and `delivered` both lists are empty; e2e: create a sale through the API → `GET /ventes` HTML shows the platform and the formatted profit.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the three commands. Expected: PASS.
- [ ] **Step 5:** Commit, push, and update PR #1's description (or open the next PR if #1 is merged) with the list of screens.
