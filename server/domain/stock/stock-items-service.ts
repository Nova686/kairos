import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { locations, products, purchases, stockItems } from '../../database/schema/index.ts'
import { isProductCategory, type ProductCategory } from '../../../shared/catalogue/product-category.ts'
import { isConditionAllowed, type ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import type { StockItemStatus } from '../../../shared/stock/stock-item-status.ts'
import { findOwnedOr404, lockOwnedOr404 } from '../ownership/find-owned-or-404.ts'
import type { StockItem } from './purchases-service.ts'
import { canonicalCompanyName } from '../../../shared/prices/grading-company.ts'

export type StockItemChanges = {
  condition?: ConditionCode
  locationId?: string | null
  notes?: string | null
  gradingCompany?: string | null
  grade?: string | null
  certificateNumber?: string | null
}

export type StockItemFilters = {
  status?: StockItemStatus[]
  category?: ProductCategory
  locationId?: string
  productId?: string
  search?: string
}

export type StockItemWithProduct = StockItem & {
  productName: string
  productImageUrl: string | null
  productCategory: string
  purchaseTrackingReference: string | null
}

const unprocessable = (message: string) => createError({ statusCode: 422, statusMessage: message })

const isBlank = (text: string | null): boolean => text === null || text.trim() === ''

const normalizeForSearch = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const stockItemWithProductColumns = {
  stockItem: stockItems,
  productName: products.name,
  productImageUrl: products.imageUrl,
  productCategory: products.category,
  purchaseTrackingReference: purchases.trackingReference,
}

const flattenStockItem = (row: {
  stockItem: StockItem
  productName: string
  productImageUrl: string | null
  productCategory: string
  purchaseTrackingReference: string | null
}): StockItemWithProduct => ({
  ...row.stockItem,
  productName: row.productName,
  productImageUrl: row.productImageUrl,
  productCategory: row.productCategory,
  purchaseTrackingReference: row.purchaseTrackingReference,
})

export const findStockItem = async (
  database: KairosDatabase,
  ownerId: string,
  stockItemId: string,
): Promise<StockItemWithProduct> => {
  await findOwnedOr404(database, stockItems, stockItemId, ownerId)
  const [row] = await database
    .select(stockItemWithProductColumns)
    .from(stockItems)
    .innerJoin(products, eq(products.id, stockItems.productId))
    .innerJoin(purchases, eq(purchases.id, stockItems.purchaseId))
    .where(eq(stockItems.id, stockItemId))
  return flattenStockItem(row!)
}

export const listStockItems = async (
  database: KairosDatabase,
  ownerId: string,
  filters: StockItemFilters,
): Promise<StockItemWithProduct[]> => {
  const conditions = [eq(stockItems.ownerId, ownerId)]
  if (filters.status !== undefined && filters.status.length > 0) {
    conditions.push(inArray(stockItems.status, filters.status))
  }
  if (filters.category !== undefined) {
    conditions.push(eq(products.category, filters.category))
  }
  if (filters.locationId !== undefined) {
    conditions.push(eq(stockItems.locationId, filters.locationId))
  }
  if (filters.productId !== undefined) {
    conditions.push(eq(stockItems.productId, filters.productId))
  }
  const rows = await database
    .select(stockItemWithProductColumns)
    .from(stockItems)
    .innerJoin(products, eq(products.id, stockItems.productId))
    .innerJoin(purchases, eq(purchases.id, stockItems.purchaseId))
    .where(and(...conditions))
    .orderBy(asc(products.name), desc(stockItems.createdAt))
  const matchingRows = filters.search === undefined || filters.search.trim() === ''
    ? rows
    : rows.filter(row => normalizeForSearch(row.productName).includes(normalizeForSearch(filters.search!.trim())))
  return matchingRows.map(flattenStockItem)
}

export const receiveStockItem = async (
  database: KairosDatabase,
  ownerId: string,
  stockItemId: string,
  receivedOn: string,
): Promise<StockItem> => {
  const inTransitStockItem = await findOwnedOr404(database, stockItems, stockItemId, ownerId)
  const [purchase] = await database
    .select({ purchasedOn: purchases.purchasedOn })
    .from(purchases)
    .where(eq(purchases.id, inTransitStockItem.purchaseId))
  if (receivedOn < purchase!.purchasedOn) {
    throw unprocessable('La réception ne peut pas précéder l’achat')
  }
  const [receivedStockItem] = await database
    .update(stockItems)
    .set({ status: 'in-stock', receivedOn })
    .where(and(eq(stockItems.id, stockItemId), eq(stockItems.ownerId, ownerId), eq(stockItems.status, 'in-transit')))
    .returning()
  if (!receivedStockItem) {
    throw createError({ statusCode: 409, statusMessage: 'Cet exemplaire n’est pas en livraison' })
  }
  return receivedStockItem
}

export const updateStockItem = (
  database: KairosDatabase,
  ownerId: string,
  stockItemId: string,
  changes: StockItemChanges,
): Promise<StockItem> => database.transaction(async (transaction) => {
  const currentStockItem = await lockOwnedOr404(transaction, stockItems, stockItemId, ownerId)
  const [product] = await transaction.select().from(products).where(eq(products.id, currentStockItem.productId))
  const category = isProductCategory(product!.category) ? product!.category : 'other'

  const nextCondition = (changes.condition ?? currentStockItem.condition) as ConditionCode
  const nextGradingCompany = changes.gradingCompany === undefined ? currentStockItem.gradingCompany : changes.gradingCompany
  const nextGrade = changes.grade === undefined ? currentStockItem.grade : changes.grade
  const nextCertificateNumber = changes.certificateNumber === undefined
    ? currentStockItem.certificateNumber
    : changes.certificateNumber

  if (!isConditionAllowed(category, nextCondition)) {
    throw unprocessable('État non autorisé pour cette catégorie')
  }
  if (category === 'graded-card') {
    if (isBlank(nextGradingCompany) || isBlank(nextGrade)) {
      throw unprocessable('Société de gradation et note requises pour une carte gradée')
    }
  } else if (nextGradingCompany !== null || nextGrade !== null || nextCertificateNumber !== null) {
    throw unprocessable('Les champs de gradation ne concernent que les cartes gradées')
  }
  if (changes.locationId !== undefined && changes.locationId !== null) {
    await findOwnedOr404(transaction, locations, changes.locationId, ownerId)
  }

  const [updatedStockItem] = await transaction
    .update(stockItems)
    .set({
      condition: nextCondition,
      gradingCompany: nextGradingCompany === null ? null : canonicalCompanyName(nextGradingCompany),
      grade: nextGrade,
      certificateNumber: nextCertificateNumber,
      locationId: changes.locationId === undefined ? currentStockItem.locationId : changes.locationId,
      notes: changes.notes === undefined ? currentStockItem.notes : changes.notes,
    })
    .where(and(eq(stockItems.id, stockItemId), eq(stockItems.ownerId, ownerId)))
    .returning()
  return updatedStockItem!
})
