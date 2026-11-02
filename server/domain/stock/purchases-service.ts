import { desc, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { locations, purchases, saleItems, stockItems } from '../../database/schema/index.ts'
import { isProductCategory, type ProductCategory } from '../../../shared/catalogue/product-category.ts'
import { isConditionAllowed, type ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import { allocateCents } from '../../../shared/money/allocate-cents.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { findOwnedOr404 } from '../ownership/find-owned-or-404.ts'

export type Purchase = typeof purchases.$inferSelect
export type StockItem = typeof stockItems.$inferSelect

export type PurchaseLineDraft = {
  productId: string
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
  certificateNumber: string | null
  locationId: string | null
  allocatedPurchaseCents: number | null
}

export type PurchaseDraft = {
  purchasedOn: string
  sellerLabel: string | null
  totalPriceCents: number
  feesCents: number
  trackingReference: string | null
  inTransit: boolean
  lines: PurchaseLineDraft[]
}

const unprocessable = (message: string) => createError({ statusCode: 422, statusMessage: message })

const isBlank = (text: string | null): boolean => text === null || text.trim() === ''

const resolveAllocations = (draft: PurchaseDraft): number[] => {
  const totalCostCents = draft.totalPriceCents + draft.feesCents
  const givenAllocations = draft.lines.map(line => line.allocatedPurchaseCents)
  const givenCount = givenAllocations.filter(allocation => allocation !== null).length
  if (givenCount === 0) {
    return allocateCents(totalCostCents, draft.lines.map(() => 1))
  }
  if (givenCount !== draft.lines.length) {
    throw unprocessable('Les répartitions doivent être renseignées sur toutes les lignes ou aucune')
  }
  const allocations = givenAllocations as number[]
  if (allocations.some(allocation => allocation < 0)
    || allocations.reduce((sum, allocation) => sum + allocation, 0) !== totalCostCents) {
    throw unprocessable('Les répartitions doivent totaliser le prix et les frais')
  }
  return allocations
}

const assertLineGradingFields = (category: ProductCategory, line: PurchaseLineDraft): void => {
  if (category === 'graded-card') {
    if (isBlank(line.gradingCompany) || isBlank(line.grade)) {
      throw unprocessable('Société de gradation et note requises pour une carte gradée')
    }
    return
  }
  if (line.gradingCompany !== null || line.grade !== null || line.certificateNumber !== null) {
    throw unprocessable('Les champs de gradation ne concernent que les cartes gradées')
  }
}

const validateLine = async (database: KairosDatabase, ownerId: string, line: PurchaseLineDraft): Promise<void> => {
  const product = await findProductOr404(database, line.productId)
  const category = isProductCategory(product.category) ? product.category : 'other'
  if (!isConditionAllowed(category, line.condition)) {
    throw unprocessable('État non autorisé pour cette catégorie')
  }
  assertLineGradingFields(category, line)
  if (line.locationId !== null) {
    await findOwnedOr404(database, locations, line.locationId, ownerId)
  }
}

export const createPurchase = async (
  database: KairosDatabase,
  ownerId: string,
  draft: PurchaseDraft,
): Promise<{ purchase: Purchase, stockItems: StockItem[] }> => {
  if (draft.lines.length === 0) {
    throw unprocessable('Un achat contient au moins une ligne')
  }
  if (draft.totalPriceCents < 0 || draft.feesCents < 0) {
    throw unprocessable('Montants négatifs refusés')
  }
  const allocations = resolveAllocations(draft)
  for (const line of draft.lines) {
    await validateLine(database, ownerId, line)
  }

  return database.transaction(async (transaction) => {
    const [purchase] = await transaction
      .insert(purchases)
      .values({
        ownerId,
        purchasedOn: draft.purchasedOn,
        sellerLabel: draft.sellerLabel,
        totalPriceCents: draft.totalPriceCents,
        feesCents: draft.feesCents,
        trackingReference: draft.trackingReference,
      })
      .returning()
    const createdStockItems = await transaction
      .insert(stockItems)
      .values(draft.lines.map((line, lineIndex) => ({
        ownerId,
        productId: line.productId,
        purchaseId: purchase!.id,
        condition: line.condition,
        gradingCompany: line.gradingCompany,
        grade: line.grade,
        certificateNumber: line.certificateNumber,
        allocatedPurchaseCents: allocations[lineIndex]!,
        locationId: line.locationId,
        status: draft.inTransit ? 'in-transit' : 'in-stock',
        receivedOn: draft.inTransit ? null : draft.purchasedOn,
      })))
      .returning()
    return { purchase: purchase!, stockItems: createdStockItems }
  })
}

export const listPurchases = (database: KairosDatabase, ownerId: string): Promise<Purchase[]> =>
  database
    .select()
    .from(purchases)
    .where(eq(purchases.ownerId, ownerId))
    .orderBy(desc(purchases.purchasedOn), desc(purchases.createdAt))

export const deletePurchase = async (database: KairosDatabase, ownerId: string, purchaseId: string): Promise<void> => {
  await findOwnedOr404(database, purchases, purchaseId, ownerId)
  await database.transaction(async (transaction) => {
    const purchaseStockItems = await transaction
      .select({ id: stockItems.id, status: stockItems.status })
      .from(stockItems)
      .where(eq(stockItems.purchaseId, purchaseId))
    const stockItemIds = purchaseStockItems.map(stockItem => stockItem.id)
    const hasSoldStockItem = purchaseStockItems.some(
      stockItem => stockItem.status === 'sold' || stockItem.status === 'sold-in-transit',
    )
    const soldInSale = stockItemIds.length === 0
      ? []
      : await transaction
          .select({ stockItemId: saleItems.stockItemId })
          .from(saleItems)
          .where(inArray(saleItems.stockItemId, stockItemIds))
    if (hasSoldStockItem || soldInSale.length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Un exemplaire de cet achat est vendu' })
    }
    await transaction.delete(stockItems).where(eq(stockItems.purchaseId, purchaseId))
    await transaction.delete(purchases).where(eq(purchases.id, purchaseId))
  })
}
