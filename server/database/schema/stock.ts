import { date, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './accounts.ts'
import { products } from './catalogue.ts'

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique().on(table.ownerId, table.label)])

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  purchasedOn: date('purchased_on').notNull(),
  sellerLabel: text('seller_label'),
  totalPriceCents: integer('total_price_cents').notNull(),
  feesCents: integer('fees_cents').notNull().default(0),
  trackingReference: text('tracking_reference'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const stockItems = pgTable('stock_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id, { onDelete: 'restrict' }),
  condition: text('condition').notNull(),
  gradingCompany: text('grading_company'),
  grade: text('grade'),
  certificateNumber: text('certificate_number'),
  allocatedPurchaseCents: integer('allocated_purchase_cents').notNull(),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'restrict' }),
  status: text('status').notNull(),
  notes: text('notes'),
  receivedOn: date('received_on'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
