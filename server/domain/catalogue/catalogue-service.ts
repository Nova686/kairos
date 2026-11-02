import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { catalogueChanges, productBarcodes, products } from '../../database/schema/index.ts'
import { productDraftFieldNames, type ProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { appendCatalogueChanges, creationFieldName } from './catalogue-journal.ts'

export { listProductChanges } from './catalogue-journal.ts'

export type Product = typeof products.$inferSelect

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const notFound = () => createError({ statusCode: 404, statusMessage: 'Introuvable' })

const hasSameValue = (firstValue: unknown, secondValue: unknown): boolean =>
  JSON.stringify(firstValue ?? null) === JSON.stringify(secondValue ?? null)

export const findProductOr404 = async (database: KairosDatabase, productId: string): Promise<Product> => {
  const [product] = uuidPattern.test(productId)
    ? await database.select().from(products).where(eq(products.id, productId))
    : []
  if (!product) {
    throw notFound()
  }
  return product
}

export const findProductByBarcode = async (database: KairosDatabase, barcode: string): Promise<Product | null> => {
  const [barcodeMatch] = await database
    .select({ product: products })
    .from(productBarcodes)
    .innerJoin(products, eq(products.id, productBarcodes.productId))
    .where(eq(productBarcodes.barcode, barcode))
  return barcodeMatch?.product ?? null
}

export const createProduct = (database: KairosDatabase, userId: string, draft: ProductDraft): Promise<Product> =>
  database.transaction(async (transaction) => {
    const [createdProduct] = await transaction
      .insert(products)
      .values({ ...draft, createdByUserId: userId })
      .returning()
    await appendCatalogueChanges(transaction, [
      { productId: createdProduct!.id, userId, fieldName: creationFieldName, previousValue: null, newValue: draft },
    ])
    return createdProduct!
  })

export const updateProduct = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  changes: Partial<ProductDraft>,
): Promise<Product> => {
  const currentProduct = await findProductOr404(database, productId)
  const changedFieldNames = productDraftFieldNames.filter(
    fieldName => fieldName in changes && !hasSameValue(currentProduct[fieldName], changes[fieldName]),
  )
  if (changedFieldNames.length === 0) {
    return currentProduct
  }
  return database.transaction(async (transaction) => {
    const [updatedProduct] = await transaction
      .update(products)
      .set({
        ...Object.fromEntries(changedFieldNames.map(fieldName => [fieldName, changes[fieldName]])),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning()
    await appendCatalogueChanges(
      transaction,
      changedFieldNames.map(fieldName => ({
        productId,
        userId,
        fieldName,
        previousValue: currentProduct[fieldName],
        newValue: changes[fieldName],
      })),
    )
    return updatedProduct!
  })
}

export const revertCatalogueChange = async (
  database: KairosDatabase,
  userId: string,
  changeId: string,
): Promise<Product> => {
  const [change] = uuidPattern.test(changeId)
    ? await database.select().from(catalogueChanges).where(eq(catalogueChanges.id, changeId))
    : []
  if (!change || change.productId === null) {
    throw notFound()
  }
  const revertableFieldName = productDraftFieldNames.find(fieldName => fieldName === change.fieldName)
  if (!revertableFieldName) {
    throw createError({ statusCode: 409, statusMessage: 'Cette modification ne peut pas être annulée' })
  }
  const [existingRevert] = await database
    .select({ id: catalogueChanges.id })
    .from(catalogueChanges)
    .where(eq(catalogueChanges.revertedChangeId, changeId))
  if (existingRevert) {
    throw createError({ statusCode: 409, statusMessage: 'Cette modification a déjà été annulée' })
  }
  const changedProductId = change.productId
  const currentProduct = await findProductOr404(database, changedProductId)
  return database.transaction(async (transaction) => {
    const [revertedProduct] = await transaction
      .update(products)
      .set({ [revertableFieldName]: change.previousValue, updatedAt: new Date() })
      .where(eq(products.id, changedProductId))
      .returning()
    await appendCatalogueChanges(transaction, [
      {
        productId: changedProductId,
        userId,
        fieldName: revertableFieldName,
        previousValue: currentProduct[revertableFieldName],
        newValue: change.previousValue,
        revertedChangeId: change.id,
      },
    ])
    return revertedProduct!
  })
}

export const attachBarcode = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  barcode: string,
): Promise<void> => {
  await findProductOr404(database, productId)
  const linkedProduct = await findProductByBarcode(database, barcode)
  if (linkedProduct) {
    if (linkedProduct.id === productId) {
      return
    }
    throw createError({ statusCode: 409, statusMessage: 'Ce code-barres est déjà lié à un autre produit' })
  }
  await database.insert(productBarcodes).values({ barcode, productId, createdByUserId: userId })
}
