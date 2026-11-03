import { type AnyPgColumn, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './accounts.ts'

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  productType: text('product_type'),
  seriesName: text('series_name'),
  language: text('language'),
  imageUrl: text('image_url'),
  lastEmbeddingFailureAt: timestamp('last_embedding_failure_at', { withTimezone: true }),
  cardmarketProductId: integer('cardmarket_product_id'),
  tcgdexCardId: text('tcgdex_card_id'),
  pokemontcgCardId: text('pokemontcg_card_id'),
  ebayQuery: text('ebay_query'),
  ebayExcludedKeywords: text('ebay_excluded_keywords').array().notNull().default([]),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const productBarcodes = pgTable('product_barcodes', {
  barcode: text('barcode').primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const catalogueChanges = pgTable('catalogue_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }),
  subject: text('subject').notNull().default('product'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  fieldName: text('field_name').notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  revertedChangeId: uuid('reverted_change_id').references((): AnyPgColumn => catalogueChanges.id, { onDelete: 'restrict' }),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cardmarketProducts = pgTable('cardmarket_products', {
  idProduct: integer('id_product').primaryKey(),
  name: text('name').notNull(),
  categoryName: text('category_name').notNull(),
  idExpansion: integer('id_expansion').notNull(),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
})
