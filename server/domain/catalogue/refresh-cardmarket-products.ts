import { count, sql } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { cardmarketProducts } from '../../database/schema/index.ts'
import { downloadCardmarketSealedProducts, pokemonGameId } from '../../../src/price-sources/cardmarket/cardmarket-files.ts'
import type { FetchFunction } from '../../../src/source-http/request-source-json.ts'

const upsertBatchSize = 1000

export const countCardmarketProducts = async (database: KairosDatabase): Promise<number> => {
  const [productCount] = await database.select({ total: count() }).from(cardmarketProducts)
  return productCount!.total
}

export const refreshCardmarketProducts = async (
  database: KairosDatabase,
  fetchFunction?: FetchFunction,
): Promise<number> => {
  const downloadedProducts = await downloadCardmarketSealedProducts(pokemonGameId, fetchFunction)
  const refreshedAt = new Date()
  for (let batchStart = 0; batchStart < downloadedProducts.length; batchStart += upsertBatchSize) {
    await database
      .insert(cardmarketProducts)
      .values(
        downloadedProducts.slice(batchStart, batchStart + upsertBatchSize).map(downloadedProduct => ({
          idProduct: downloadedProduct.idProduct,
          name: downloadedProduct.name,
          categoryName: downloadedProduct.categoryName,
          idExpansion: downloadedProduct.idExpansion,
          refreshedAt,
        })),
      )
      .onConflictDoUpdate({
        target: cardmarketProducts.idProduct,
        set: {
          name: sql`excluded.name`,
          categoryName: sql`excluded.category_name`,
          idExpansion: sql`excluded.id_expansion`,
          refreshedAt: sql`excluded.refreshed_at`,
        },
      })
  }
  return downloadedProducts.length
}
