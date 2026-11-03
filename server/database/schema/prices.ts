import { date, index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './accounts.ts'
import { products } from './catalogue.ts'

export const priceSnapshots = pgTable('price_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  source: text('source').notNull(),
  kind: text('kind').notNull(),
  sourceCondition: text('source_condition'),
  kairosCondition: text('kairos_condition'),
  gradingCompany: text('grading_company'),
  grade: text('grade'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  averageCents: integer('average_cents'),
  medianCents: integer('median_cents'),
  lowCents: integer('low_cents'),
  trendCents: integer('trend_cents'),
  listingCount: integer('listing_count').notNull().default(0),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('price_snapshots_product_observed_idx').on(table.productId, table.observedAt),
])

export const priceSnapshotListings = pgTable('price_snapshot_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => priceSnapshots.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  priceCents: integer('price_cents').notNull(),
  shippingCents: integer('shipping_cents'),
  sourceCondition: text('source_condition'),
  url: text('url').notNull(),
  imageUrl: text('image_url'),
})

export const excludedListings = pgTable('excluded_listings', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  url: text('url').notNull(),
  excludedByUserId: uuid('excluded_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  excludedAt: timestamp('excluded_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.productId, table.url] }),
])

export const conditionMappings = pgTable('condition_mappings', {
  category: text('category').notNull(),
  source: text('source').notNull(),
  sourceCondition: text('source_condition').notNull(),
  kairosCondition: text('kairos_condition').notNull(),
}, table => [
  primaryKey({ columns: [table.category, table.source, table.sourceCondition] }),
])

export const titleConditionRules = pgTable('title_condition_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  keywords: text('keywords').array().notNull(),
  kairosCondition: text('kairos_condition').notNull(),
  priority: integer('priority').notNull(),
})

export const priceRefreshRequests = pgTable('price_refresh_requests', {
  productId: uuid('product_id').primaryKey().references(() => products.id, { onDelete: 'restrict' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }),
  requestedByUserId: uuid('requested_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  lastEbayRefreshAt: timestamp('last_ebay_refresh_at', { withTimezone: true }),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
})

export const stockValueSnapshots = pgTable('stock_value_snapshots', {
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  snapshotOn: date('snapshot_on', { mode: 'string' }).notNull(),
  purchaseCostCents: integer('purchase_cost_cents').notNull(),
  valuedPurchaseCostCents: integer('valued_purchase_cost_cents').notNull(),
  estimatedValueCents: integer('estimated_value_cents').notNull(),
  valuedItemCount: integer('valued_item_count').notNull(),
  approximateItemCount: integer('approximate_item_count').notNull(),
  unvaluedItemCount: integer('unvalued_item_count').notNull(),
}, table => [
  primaryKey({ columns: [table.ownerId, table.snapshotOn] }),
])
