import { and, eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { excludedListings } from '../../database/schema/index.ts'
import { appendCatalogueChanges } from '../catalogue/catalogue-journal.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { enqueueProducts } from './price-refresh-queue.ts'
import { normalizeListingUrl } from './record-ebay-snapshots.ts'

const excludedListingFieldName = 'excludedListing'

export const excludeListing = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  url: string,
  now: Date,
): Promise<void> => {
  await findProductOr404(database, productId)
  const normalizedUrl = normalizeListingUrl(url)
  await database.transaction(async (transaction) => {
    const insertedRows = await transaction
      .insert(excludedListings)
      .values({ productId, url: normalizedUrl, excludedByUserId: userId })
      .onConflictDoNothing()
      .returning({ url: excludedListings.url })
    if (insertedRows.length > 0) {
      await appendCatalogueChanges(transaction as unknown as KairosDatabase, [
        { productId, userId, fieldName: excludedListingFieldName, previousValue: null, newValue: normalizedUrl },
      ])
      await enqueueProducts(transaction as unknown as KairosDatabase, [productId], userId, now)
    }
  })
}

export const restoreListing = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  url: string,
  now: Date,
): Promise<void> => {
  await findProductOr404(database, productId)
  const normalizedUrl = normalizeListingUrl(url)
  await database.transaction(async (transaction) => {
    const deletedRows = await transaction
      .delete(excludedListings)
      .where(and(eq(excludedListings.productId, productId), eq(excludedListings.url, normalizedUrl)))
      .returning({ url: excludedListings.url })
    if (deletedRows.length > 0) {
      await appendCatalogueChanges(transaction as unknown as KairosDatabase, [
        { productId, userId, fieldName: excludedListingFieldName, previousValue: normalizedUrl, newValue: null },
      ])
      await enqueueProducts(transaction as unknown as KairosDatabase, [productId], userId, now)
    }
  })
}
