# Coffre Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved « Coffre » art direction (dark collector vault) to every Kairos screen, on desktop and iPhone.

**Architecture:** One Vuetify 4 theme (`coffre`, dark) plus component defaults carry most of the look; a small set of global utility classes (BEM) carries what Vuetify cannot express (monospaced figures, holographic border, uppercase labels). The layout switches between a side drawer (≥ md) and a bottom navigation (< md) with Vuetify display classes, hydration-safe. Pages keep their composables and data flow; only templates and styles change, except where the mockup changes behaviour (barcode/photo tabs on phones only).

**Tech Stack:** Nuxt 4, Vuetify 4, chart.js / vue-chartjs, Google Fonts (Sora, IBM Plex Sans, IBM Plex Mono), MDI icons.

**Spec:** the approved mockup `/home/nzim/.claude/jobs/4f626574/tmp/kairos-mockup/kairos-directions.html` (direction « coffre »: tokens in `.k--coffre`, implementation sheet in the `directions[0]` object: palette, typography, shapes, Vuetify theme and defaults) and the design document `docs/superpowers/specs/2026-11-02-kairos-design.md` for behaviour.

## Global Constraints

- Coffre palette exactly: background `#0b0f14`, surface `#131922`, surface-variant `#1a2230`, border `#263041`, text `#e7ecf3`, secondary text `#8b97a8`, primary `#6fa8dc` (on-primary `#0b0f14`), accent `#e3a44a`, success `#4cc38a`, error `#f0716a`; source colours eBay `#6fa8dc`, Cardmarket `#4cc38a`, Vinted `#a993f0`, Leboncoin `#e3a44a`; holographic gradient `conic-gradient(from 140deg, #6fa8dc, #a993f0, #e889b8, #e3a44a, #5fd1c1, #6fa8dc)` only on the « Valeur actuelle » card, the product « valeur retenue » card and graded-card (PSA) thumbnails.
- Typography: Sora 600–700 for titles, IBM Plex Sans 400–600 for text, IBM Plex Mono 500 with tabular figures for every amount; labels in 11 px uppercase with 0.08 em spacing.
- Shapes: cards radius 14 px, elevation 0, 1 px border; chips pill, tonal; buttons radius lg, flat; primary button gradient `#84b6e3 → #5d97cf`.
- iPhone (< md): bottom navigation Accueil, Stock, Ajouter (raised primary button), Ventes, Plus (Plus opens Livraisons, Dettes, Lieux, Personnes, Réglages, Déconnexion); no visible scrollbars in scroll areas; computer (≥ md): side drawer with logo + 9 entries and a separator before Lieux.
- Barcode and photo add modes only on phones (coarse pointer or narrow viewport); computers get text search + note « Le scan par code-barres et par photo se fait depuis l'iPhone ».
- Amount states preserved: « ≈ » with dashed underline and tooltip for approximate values, « pas de prix » for held items without value, « — » for non-held items; gains green, losses red, zero neutral.
- Hydration-safe layout switching (display classes / CSS), no `useDisplay().mobile` for layout.
- Existing behaviour and tests stay green; no comments in code; intent-revealing names; BEM for custom classes; `npm test`, `npm run typecheck`, `npm run lint` green; PWA theme/background colours updated to the Coffre background.

## Review Focus

- Contrast: secondary text `#8b97a8` on `#131922` and chip text stay readable (WCAG AA for body text).
- Long product names never overflow cards, rows or table cells (ellipsis or wrap, never past the border).
- Bottom navigation does not hide the last row of a scrolling page (safe-area padding on iPhone).
- The holographic border appears only where listed, never on every card.
- Desktop users never see camera tabs; phones still reach barcode, PSA and photo flows.

---

### Task 1: Coffre theme, fonts and app shell

**Files:** `app/plugins/vuetify.ts`, `shared/theme/brand-colors.ts`, `nuxt.config.ts` (fonts link, PWA colours), `app/assets/styles/coffre.css` (new, global utilities: `.kairos-figure`, `.kairos-label`, `.kairos-holo`, `.kairos-approx`, scrollbar styling), `app/layouts/default.vue`, `app/components/navigation/MainNavigation.vue`, `app/components/navigation/MobileNavigation.vue` (new), `app/composables/useMainNavigation.ts`, login and invitation pages' shell if they use another layout.
- [ ] Tests first for any pure helper added (e.g. which entries go under « Plus »); e2e app-shell test still passes (asserts « Kairos » and navigation labels).
- [ ] Implement theme (dark `coffre` as default), defaults (VCard, VChip, VBtn, VDataTable), fonts, shell (drawer ≥ md, bottom nav < md with Plus menu), global utilities.
- [ ] `npm test && npm run typecheck && npm run lint`; commit.

### Task 2: Dashboard, stock and product page

**Files:** `app/pages/index.vue`, `app/components/dashboard/*`, `app/pages/stock/index.vue`, `app/pages/stock/[id].vue`, `app/components/stock/*`, `app/pages/produits/[id].vue`, `app/components/prices/*`.
- [ ] Dashboard: three KPI cards (Valeur actuelle hero with holo + gradient figure, Coût du stock, Plus-value latente), value-vs-cost chart (value `#6fa8dc` with area gradient, cost `#8b97a8` dashed), recent sales list, deliveries and debts tiles.
- [ ] Stock: filter chips + search + location/sort; desktop table and phone cards as in the mockup (thumbnail 52 px, condition chip, location, purchase, value states, gain).
- [ ] Product page: header with large thumbnail, KPI row, price by source × condition table with highlighted retained cell and source colour dots, history chart in source colours, « Relever maintenant » primary button.
- [ ] Keep existing unit/e2e tests green (update selectors only if they relied on removed markup, never weaken assertions); `npm test && npm run typecheck && npm run lint`; commit.

### Task 3: Add flow and remaining pages

**Files:** `app/pages/ajouter/index.vue`, `app/components/scan/*`, `app/components/catalogue/ProductCandidatePicker.vue`, `app/components/stock/PurchaseForm.vue`, `app/pages/ventes/*`, `app/pages/livraisons.vue`, `app/pages/dettes.vue`, `app/pages/lieux.vue`, `app/pages/personnes.vue`, `app/pages/reglages/*`, `app/pages/connexion.vue`, `app/pages/invitation/[code].vue`, related components.
- [ ] Add flow: phones get Code-barres / Photo / Texte tabs styled as in the mockup (viewport frame with amber corners and scan line); computers get text search only + the note; candidate groups « Dans votre catalogue » / « Cardmarket »…; purchase form card « Achat en cours ». Unit-test the capability decision (pure function: coarse pointer or narrow viewport → scan modes).
- [ ] Restyle the remaining pages with the same cards, labels, figures and chips; login/invitation pages centred card with the logo.
- [ ] `npm test && npm run typecheck && npm run lint`; commit.
