import { index, pgTable, real, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { products } from './catalogue.ts'

export const productImageEmbeddings = pgTable(
  'product_image_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
    origin: text('origin').notNull(),
    imageUrl: text('image_url'),
    uploadFingerprint: text('upload_fingerprint').unique(),
    embedding: real('embedding').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('product_image_embeddings_product_id_index').on(table.productId),
    uniqueIndex('product_image_embeddings_one_catalogue_image_per_product')
      .on(table.productId)
      .where(sql`${table.origin} = 'catalogue-image'`),
  ],
)
