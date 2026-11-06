import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { catalogueChanges, productBarcodes, products } from '../../database/schema/index.ts'
import { readBarcodeJournalValue, toBarcodeJournalValue } from '../../../shared/catalogue/barcode-journal-value.ts'
import { productDraftFieldNames, type ProductDraft } from '../../../shared/catalogue/product-draft.ts'
import { deleteCatalogueImageEmbeddings, invalidateEmbeddingMatrix } from '../scan/product-image-embeddings.ts'
import { appendCatalogueChanges, creationFieldName } from './catalogue-journal.ts'

export { listProductChanges } from './catalogue-journal.ts'

export type Product = typeof products.$inferSelect

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const imageUrlFieldName = 'imageUrl'

const notFound = () => createError({ statusCode: 404, statusMessage: 'Introuvable' })

const conflict = (message: string) => createError({ statusCode: 409, statusMessage: message })

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

const lockProductOr404 = async (transaction: Pick<KairosDatabase, 'select'>, productId: string): Promise<Product> => {
  const [lockedProduct] = uuidPattern.test(productId)
    ? await transaction.select().from(products).where(eq(products.id, productId)).for('update')
    : []
  if (!lockedProduct) {
    throw notFound()
  }
  return lockedProduct
}

const assertNotRevertedYet = async (transaction: Pick<KairosDatabase, 'select'>, changeId: string): Promise<void> => {
  const [existingRevert] = await transaction
    .select({ id: catalogueChanges.id })
    .from(catalogueChanges)
    .where(eq(catalogueChanges.revertedChangeId, changeId))
  if (existingRevert) {
    throw conflict('Cette modification a déjà été annulée')
  }
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
  const { savedProduct, changedFieldNames } = await database.transaction(async (transaction) => {
    const currentProduct = await lockProductOr404(transaction, productId)
    const fieldNamesToChange = productDraftFieldNames.filter(
      fieldName => fieldName in changes && !hasSameValue(currentProduct[fieldName], changes[fieldName]),
    )
    if (fieldNamesToChange.length === 0) {
      return { savedProduct: currentProduct, changedFieldNames: fieldNamesToChange }
    }
    const [updatedProduct] = await transaction
      .update(products)
      .set({
        ...Object.fromEntries(fieldNamesToChange.map(fieldName => [fieldName, changes[fieldName]])),
        ...(fieldNamesToChange.includes(imageUrlFieldName) ? { lastEmbeddingFailureAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning()
    if (fieldNamesToChange.includes(imageUrlFieldName)) {
      await deleteCatalogueImageEmbeddings(transaction, productId)
    }
    await appendCatalogueChanges(
      transaction,
      fieldNamesToChange.map(fieldName => ({
        productId,
        userId,
        fieldName,
        previousValue: currentProduct[fieldName],
        newValue: changes[fieldName],
      })),
    )
    return { savedProduct: updatedProduct!, changedFieldNames: fieldNamesToChange }
  })
  if (changedFieldNames.includes(imageUrlFieldName)) {
    invalidateEmbeddingMatrix()
  }
  return savedProduct
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
  if (change.subject === barcodeSubject) {
    await assertNotRevertedYet(database, changeId)
    return revertBarcodeChange(database, userId, change)
  }
  if (!revertableFieldName) {
    throw conflict('Cette modification ne peut pas être annulée')
  }
  const changedProductId = change.productId
  const isImageRevert = revertableFieldName === imageUrlFieldName
  const savedProduct = await database.transaction(async (transaction) => {
    const currentProduct = await lockProductOr404(transaction, changedProductId)
    await assertNotRevertedYet(transaction, changeId)
    if (!hasSameValue(currentProduct[revertableFieldName], change.newValue)) {
      throw conflict('Ce champ a été modifié depuis : annulez d’abord la modification la plus récente')
    }
    const [revertedProduct] = await transaction
      .update(products)
      .set({
        [revertableFieldName]: change.previousValue,
        ...(isImageRevert ? { lastEmbeddingFailureAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, changedProductId))
      .returning()
    if (isImageRevert) {
      await deleteCatalogueImageEmbeddings(transaction, changedProductId)
    }
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
  if (isImageRevert) {
    invalidateEmbeddingMatrix()
  }
  return savedProduct
}

const barcodeSubject = 'barcode'

const barcodeNoLongerLinkedMessage = 'Ce code-barres n\u2019est plus lié à ce produit'

export const attachBarcode = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  barcode: string,
  revertedChangeId?: string,
): Promise<void> => {
  await findProductOr404(database, productId)
  const linkedProduct = await findProductByBarcode(database, barcode)
  if (linkedProduct) {
    if (linkedProduct.id === productId) {
      return
    }
    throw conflict('Ce code-barres est déjà lié à un autre produit')
  }
  await database.transaction(async (transaction) => {
    const insertedBarcodes = await transaction
      .insert(productBarcodes)
      .values({ barcode, productId, createdByUserId: userId })
      .onConflictDoNothing()
      .returning({ barcode: productBarcodes.barcode })
    if (insertedBarcodes.length === 0) {
      const [concurrentLink] = await transaction
        .select({ productId: productBarcodes.productId })
        .from(productBarcodes)
        .where(eq(productBarcodes.barcode, barcode))
      if (concurrentLink?.productId === productId) {
        return
      }
      throw conflict('Ce code-barres est déjà lié à un autre produit')
    }
    await appendCatalogueChanges(transaction, [
      {
        productId,
        subject: barcodeSubject,
        userId,
        fieldName: barcodeSubject,
        previousValue: null,
        newValue: toBarcodeJournalValue(barcode),
        revertedChangeId,
      },
    ])
  })
}

export const detachBarcode = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  barcode: string,
  revertedChangeId?: string,
): Promise<void> => {
  await findProductOr404(database, productId)
  const linkedProduct = await findProductByBarcode(database, barcode)
  if (linkedProduct?.id !== productId) {
    throw notFound()
  }
  await database.transaction(async (transaction) => {
    const detachedBarcodes = await transaction
      .delete(productBarcodes)
      .where(and(eq(productBarcodes.barcode, barcode), eq(productBarcodes.productId, productId)))
      .returning({ barcode: productBarcodes.barcode })
    if (detachedBarcodes.length === 0) {
      throw conflict(barcodeNoLongerLinkedMessage)
    }
    await appendCatalogueChanges(transaction, [
      {
        productId,
        subject: barcodeSubject,
        userId,
        fieldName: barcodeSubject,
        previousValue: toBarcodeJournalValue(barcode),
        newValue: null,
        revertedChangeId,
      },
    ])
  })
}

const revertBarcodeChange = async (
  database: KairosDatabase,
  userId: string,
  change: typeof catalogueChanges.$inferSelect,
): Promise<Product> => {
  const productId = change.productId!
  const linkedBarcode = readBarcodeJournalValue(change.newValue)
  const detachedBarcode = readBarcodeJournalValue(change.previousValue)
  if (linkedBarcode) {
    const linkedProduct = await findProductByBarcode(database, linkedBarcode)
    if (linkedProduct?.id !== productId) {
      throw conflict(barcodeNoLongerLinkedMessage)
    }
    await detachBarcode(database, userId, productId, linkedBarcode, change.id)
  } else if (detachedBarcode) {
    await attachBarcode(database, userId, productId, detachedBarcode, change.id)
  }
  return findProductOr404(database, productId)
}
