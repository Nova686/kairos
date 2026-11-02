import { boolean, date, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './accounts.ts'
import { stockItems } from './stock.ts'

export const persons = pgTable('persons', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  soldOn: date('sold_on').notNull(),
  platform: text('platform').notNull(),
  buyerPersonId: uuid('buyer_person_id').references(() => persons.id, { onDelete: 'restrict' }),
  totalPriceCents: integer('total_price_cents').notNull(),
  shippingIncluded: boolean('shipping_included').notNull(),
  shippingCostCents: integer('shipping_cost_cents').notNull().default(0),
  platformFeesCents: integer('platform_fees_cents').notNull().default(0),
  packagingCostCents: integer('packaging_cost_cents').notNull().default(0),
  trackingReference: text('tracking_reference'),
  deliveredOn: date('delivered_on'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const saleItems = pgTable('sale_items', {
  saleId: uuid('sale_id').notNull().references(() => sales.id, { onDelete: 'restrict' }),
  stockItemId: uuid('stock_item_id').notNull().unique().references(() => stockItems.id, { onDelete: 'restrict' }),
  allocatedSaleCents: integer('allocated_sale_cents').notNull(),
}, table => [primaryKey({ columns: [table.saleId, table.stockItemId] })])
