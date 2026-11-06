import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { debts, persons, products, saleItems, sales, stockItems } from '../../database/schema/index.ts'
import { allocateSaleNetCents, computeSaleNetCents } from '../../../shared/money/sale-profit.ts'
import { estimateItemValues } from '../valuation/value-stock.ts'
import { findOwnedOr404 } from '../ownership/find-owned-or-404.ts'

export type Sale = typeof sales.$inferSelect
export type SaleItem = typeof saleItems.$inferSelect
type StockItem = typeof stockItems.$inferSelect

export type SaleDraft = {
  soldOn: string
  platform: string
  buyerPersonId: string | null
  totalPriceCents: number
  shippingIncluded: boolean
  shippingCostCents: number
  platformFeesCents: number
  packagingCostCents: number
  trackingReference: string | null
  stockItemIds: string[]
}

export type SaleItemWithProfit = SaleItem & { allocatedPurchaseCents: number, netProfitCents: number }

export type SaleWithItems = Sale & {
  saleNetCents: number
  netProfitCents: number
  items: SaleItemWithProfit[]
}

const unprocessable = (message: string) => createError({ statusCode: 422, statusMessage: message })

const conflict = (message: string) => createError({ statusCode: 409, statusMessage: message })

const resolveSaleWeights = async (database: KairosDatabase, soldStockItems: StockItem[], now: Date): Promise<number[]> => {
  const productRows = await database
    .select({ id: products.id, category: products.category })
    .from(products)
    .where(inArray(products.id, soldStockItems.map(stockItem => stockItem.productId)))
  const categoryByProductId = new Map(productRows.map(productRow => [productRow.id, productRow.category]))
  const valuations = await estimateItemValues(
    database,
    soldStockItems.map(stockItem => ({
      productId: stockItem.productId,
      category: categoryByProductId.get(stockItem.productId)!,
      condition: stockItem.condition,
      gradingCompany: stockItem.gradingCompany,
      grade: stockItem.grade,
    })),
    now,
  )
  return valuations.every(valuation => valuation.valueCents !== null)
    ? valuations.map(valuation => valuation.valueCents!)
    : soldStockItems.map(stockItem => stockItem.allocatedPurchaseCents)
}

export const createSale = async (
  database: KairosDatabase,
  ownerId: string,
  draft: SaleDraft,
  now: Date = new Date(),
): Promise<{ sale: Sale, saleItems: SaleItem[] }> => {
  if (draft.stockItemIds.length === 0) {
    throw unprocessable('Une vente contient au moins un exemplaire')
  }
  if (new Set(draft.stockItemIds).size !== draft.stockItemIds.length) {
    throw unprocessable('Un exemplaire ne peut figurer qu\'une fois dans la vente')
  }
  if ([draft.totalPriceCents, draft.shippingCostCents, draft.platformFeesCents, draft.packagingCostCents].some(cents => cents < 0)) {
    throw unprocessable('Montants négatifs refusés')
  }
  if (draft.buyerPersonId !== null) {
    await findOwnedOr404(database, persons, draft.buyerPersonId, ownerId)
  }
  const soldStockItems: StockItem[] = []
  for (const stockItemId of draft.stockItemIds) {
    soldStockItems.push(await findOwnedOr404(database, stockItems, stockItemId, ownerId))
  }

  const saleWeights = await resolveSaleWeights(database, soldStockItems, now)

  return database.transaction(async (transaction) => {
    const currentStatuses = await transaction
      .select({ id: stockItems.id, status: stockItems.status })
      .from(stockItems)
      .where(inArray(stockItems.id, draft.stockItemIds))
    if (currentStatuses.some(stockItem => stockItem.status !== 'in-stock')) {
      throw conflict('Seuls les exemplaires en stock peuvent être vendus')
    }
    const allocations = allocateSaleNetCents(
      computeSaleNetCents(draft),
      saleWeights,
    )
    const [sale] = await transaction
      .insert(sales)
      .values({
        ownerId,
        soldOn: draft.soldOn,
        platform: draft.platform,
        buyerPersonId: draft.buyerPersonId,
        totalPriceCents: draft.totalPriceCents,
        shippingIncluded: draft.shippingIncluded,
        shippingCostCents: draft.shippingCostCents,
        platformFeesCents: draft.platformFeesCents,
        packagingCostCents: draft.packagingCostCents,
        trackingReference: draft.trackingReference,
      })
      .returning()
    const createdSaleItems = await transaction
      .insert(saleItems)
      .values(draft.stockItemIds.map((stockItemId, position) => ({
        saleId: sale!.id,
        stockItemId,
        allocatedSaleCents: allocations[position]!,
      })))
      .returning()
    await transaction
      .update(stockItems)
      .set({ status: draft.trackingReference === null ? 'sold' : 'sold-in-transit' })
      .where(and(inArray(stockItems.id, draft.stockItemIds), eq(stockItems.ownerId, ownerId)))
    return { sale: sale!, saleItems: createdSaleItems }
  })
}

export const markSaleDelivered = async (
  database: KairosDatabase,
  ownerId: string,
  saleId: string,
  deliveredOn: string,
): Promise<Sale> => {
  const soldSale = await findOwnedOr404(database, sales, saleId, ownerId)
  if (deliveredOn < soldSale.soldOn) {
    throw unprocessable('La livraison ne peut pas précéder la vente')
  }
  return database.transaction(async (transaction) => {
    const [sale] = await transaction
      .update(sales)
      .set({ deliveredOn })
      .where(and(eq(sales.id, saleId), eq(sales.ownerId, ownerId)))
      .returning()
    const soldStockItemIds = (await transaction
      .select({ stockItemId: saleItems.stockItemId })
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId))).map(saleItem => saleItem.stockItemId)
    await transaction
      .update(stockItems)
      .set({ status: 'sold' })
      .where(and(
        inArray(stockItems.id, soldStockItemIds),
        eq(stockItems.ownerId, ownerId),
        eq(stockItems.status, 'sold-in-transit'),
      ))
    return sale!
  })
}

export const deleteSale = async (database: KairosDatabase, ownerId: string, saleId: string): Promise<void> => {
  await findOwnedOr404(database, sales, saleId, ownerId)
  await database.transaction(async (transaction) => {
    const settledLinkedDebts = await transaction
      .select({ id: debts.id })
      .from(debts)
      .where(and(eq(debts.saleId, saleId), isNotNull(debts.settledOn)))
    if (settledLinkedDebts.length > 0) {
      throw conflict('Une dette liée à cette vente est soldée')
    }
    const soldStockItemIds = (await transaction
      .select({ stockItemId: saleItems.stockItemId })
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId))).map(saleItem => saleItem.stockItemId)
    await transaction.delete(debts).where(and(eq(debts.saleId, saleId), eq(debts.ownerId, ownerId)))
    await transaction.delete(saleItems).where(eq(saleItems.saleId, saleId))
    await transaction.delete(sales).where(and(eq(sales.id, saleId), eq(sales.ownerId, ownerId)))
    if (soldStockItemIds.length > 0) {
      await transaction
        .update(stockItems)
        .set({ status: 'in-stock' })
        .where(and(inArray(stockItems.id, soldStockItemIds), eq(stockItems.ownerId, ownerId)))
    }
  })
}

export const listSales = async (database: KairosDatabase, ownerId: string): Promise<SaleWithItems[]> => {
  const ownedSales = await database
    .select()
    .from(sales)
    .where(eq(sales.ownerId, ownerId))
    .orderBy(desc(sales.soldOn), desc(sales.createdAt))
  if (ownedSales.length === 0) {
    return []
  }
  const itemRows = await database
    .select({ saleItem: saleItems, allocatedPurchaseCents: stockItems.allocatedPurchaseCents })
    .from(saleItems)
    .innerJoin(stockItems, eq(stockItems.id, saleItems.stockItemId))
    .where(inArray(saleItems.saleId, ownedSales.map(sale => sale.id)))
  return ownedSales.map((sale) => {
    const items = itemRows
      .filter(row => row.saleItem.saleId === sale.id)
      .map(row => ({
        ...row.saleItem,
        allocatedPurchaseCents: row.allocatedPurchaseCents,
        netProfitCents: row.saleItem.allocatedSaleCents - row.allocatedPurchaseCents,
      }))
    return {
      ...sale,
      saleNetCents: computeSaleNetCents(sale),
      netProfitCents: items.reduce((sum, saleItem) => sum + saleItem.netProfitCents, 0),
      items,
    }
  })
}
