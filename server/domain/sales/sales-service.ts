import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { debts, persons, products, saleItems, sales, stockItems } from '../../database/schema/index.ts'
import { allocateSaleNetCents, computeSaleNetCents } from '../../../shared/money/sale-profit.ts'
import { isNonNegativeCents } from '../../../shared/validation/cents.ts'
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

export type SaleItemWithProfit = SaleItem & { productName: string, allocatedPurchaseCents: number, netProfitCents: number }

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
  const saleAmounts = [draft.totalPriceCents, draft.shippingCostCents, draft.platformFeesCents, draft.packagingCostCents]
  if (!saleAmounts.every(isNonNegativeCents)) {
    throw unprocessable('Montants en centimes entiers et positifs attendus')
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
    const lockedStockItems = await transaction
      .select({ id: stockItems.id, status: stockItems.status })
      .from(stockItems)
      .where(and(inArray(stockItems.id, draft.stockItemIds), eq(stockItems.ownerId, ownerId)))
      .for('update')
    if (lockedStockItems.length !== draft.stockItemIds.length
      || lockedStockItems.some(stockItem => stockItem.status !== 'in-stock')) {
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
    const soldStockItemRows = await transaction
      .update(stockItems)
      .set({ status: draft.trackingReference === null ? 'sold' : 'sold-in-transit' })
      .where(and(inArray(stockItems.id, draft.stockItemIds), eq(stockItems.ownerId, ownerId), eq(stockItems.status, 'in-stock')))
      .returning({ id: stockItems.id })
    if (soldStockItemRows.length !== draft.stockItemIds.length) {
      throw conflict('Seuls les exemplaires en stock peuvent être vendus')
    }
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
    if (!sale) {
      throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
    }
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
    return sale
  })
}

export const deleteSale = async (database: KairosDatabase, ownerId: string, saleId: string): Promise<void> => {
  await findOwnedOr404(database, sales, saleId, ownerId)
  await database.transaction(async (transaction) => {
    const linkedDebts = await transaction
      .select({ settledOn: debts.settledOn })
      .from(debts)
      .where(and(eq(debts.saleId, saleId), eq(debts.ownerId, ownerId)))
      .for('update')
    if (linkedDebts.some(linkedDebt => linkedDebt.settledOn !== null)) {
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

export const listSales = async (
  database: KairosDatabase,
  ownerId: string,
  { limit }: { limit?: number } = {},
): Promise<SaleWithItems[]> => {
  const ownedSalesQuery = database
    .select()
    .from(sales)
    .where(eq(sales.ownerId, ownerId))
    .orderBy(desc(sales.soldOn), desc(sales.createdAt))
  const ownedSales = limit === undefined ? await ownedSalesQuery : await ownedSalesQuery.limit(limit)
  if (ownedSales.length === 0) {
    return []
  }
  const itemRows = await database
    .select({ saleItem: saleItems, productName: products.name, allocatedPurchaseCents: stockItems.allocatedPurchaseCents })
    .from(saleItems)
    .innerJoin(stockItems, eq(stockItems.id, saleItems.stockItemId))
    .innerJoin(products, eq(products.id, stockItems.productId))
    .where(inArray(saleItems.saleId, ownedSales.map(sale => sale.id)))
    .orderBy(asc(products.name), asc(saleItems.stockItemId))
  return ownedSales.map((sale) => {
    const items = itemRows
      .filter(row => row.saleItem.saleId === sale.id)
      .map(row => ({
        ...row.saleItem,
        productName: row.productName,
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
