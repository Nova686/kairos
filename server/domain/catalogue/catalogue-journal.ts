import { asc, eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { catalogueChanges } from '../../database/schema/index.ts'

export type CatalogueChange = typeof catalogueChanges.$inferSelect

export const creationFieldName = '*'

interface CatalogueChangeEntry {
  productId: string
  userId: string
  fieldName: string
  previousValue: unknown
  newValue: unknown
  revertedChangeId?: string
}

export const appendCatalogueChanges = async (
  database: KairosDatabase,
  changeEntries: CatalogueChangeEntry[],
): Promise<void> => {
  if (changeEntries.length === 0) {
    return
  }
  await database.insert(catalogueChanges).values(changeEntries)
}

export const listProductChanges = (database: KairosDatabase, productId: string): Promise<CatalogueChange[]> =>
  database
    .select()
    .from(catalogueChanges)
    .where(eq(catalogueChanges.productId, productId))
    .orderBy(asc(catalogueChanges.changedAt), asc(catalogueChanges.id))
