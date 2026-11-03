import { and, asc, eq, isNotNull, isNull, lt, notExists, or, sql } from 'drizzle-orm'
import { safeExternalHref } from '../../../app/utils/safe-external-href.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import { productImageEmbeddings, products } from '../../database/schema/index.ts'
import { fetchCatalogueImage } from './fetch-catalogue-image.ts'
import type { ImageEmbedder } from './image-embedder.ts'
import { storeProductEmbedding } from './product-image-embeddings.ts'

export const catalogueEmbeddingBatchSize = 20
const retryAfterFailureMilliseconds = 24 * 60 * 60 * 1000

export type CatalogueImageEmbeddingDependencies = {
  embedder: ImageEmbedder
  fetchImage?: (imageUrl: string) => Promise<Buffer>
  now: Date
}

export type CatalogueImageEmbeddingSummary = { embeddedCount: number, failedCount: number }

const hasCatalogueEmbedding = (database: KairosDatabase) =>
  database
    .select({ one: sql`1` })
    .from(productImageEmbeddings)
    .where(and(eq(productImageEmbeddings.productId, products.id), eq(productImageEmbeddings.origin, 'catalogue-image')))

export const embedCatalogueImages = async (
  database: KairosDatabase,
  dependencies: CatalogueImageEmbeddingDependencies,
): Promise<CatalogueImageEmbeddingSummary> => {
  const { embedder, fetchImage = fetchCatalogueImage, now } = dependencies
  const retryCutoff = new Date(now.getTime() - retryAfterFailureMilliseconds)
  const pendingProducts = await database
    .select({ id: products.id, imageUrl: products.imageUrl })
    .from(products)
    .where(
      and(
        isNotNull(products.imageUrl),
        notExists(hasCatalogueEmbedding(database)),
        or(isNull(products.lastEmbeddingFailureAt), lt(products.lastEmbeddingFailureAt, retryCutoff)),
      ),
    )
    .orderBy(asc(products.updatedAt), asc(products.id))
    .limit(catalogueEmbeddingBatchSize)

  let embeddedCount = 0
  let failedCount = 0
  for (const pendingProduct of pendingProducts) {
    const imageUrl = pendingProduct.imageUrl!
    try {
      const safeImageUrl = safeExternalHref(imageUrl)
      if (!safeImageUrl) {
        throw new Error('URL d’image non http(s)')
      }
      const embedding = await embedder.embed(await fetchImage(safeImageUrl))
      await storeProductEmbedding(database, {
        productId: pendingProduct.id,
        origin: 'catalogue-image',
        imageUrl,
        embedding,
      })
      await database.update(products).set({ lastEmbeddingFailureAt: null }).where(eq(products.id, pendingProduct.id))
      embeddedCount += 1
    }
    catch (embeddingError) {
      console.warn(`Catalogue image embedding failed for product ${pendingProduct.id}:`, embeddingError)
      await database.update(products).set({ lastEmbeddingFailureAt: now }).where(eq(products.id, pendingProduct.id))
      failedCount += 1
    }
  }
  return { embeddedCount, failedCount }
}
