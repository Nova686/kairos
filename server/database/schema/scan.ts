import { pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { products } from './catalogue.ts'

export const productImageEmbeddings = pgTable('product_image_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  origin: text('origin').notNull(),
  imageUrl: text('image_url'),
  uploadFingerprint: text('upload_fingerprint').unique(),
  embedding: real('embedding').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
