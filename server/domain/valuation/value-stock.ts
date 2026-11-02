import { and, eq, inArray } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { products, stockItems, stockValueSnapshots, users } from '../../database/schema/index.ts'
import { isProductCategory, type ProductCategory } from '../../../shared/catalogue/product-category.ts'
import type { ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import { estimateStockItemValue, type StockItemValuation } from '../../../shared/valuation/estimate-stock-item-value.ts'
import { parisCalendarDateOf } from '../prices/start-of-paris-day.ts'
import { loadValuationSnapshots } from './load-valuation-snapshots.ts'

export type ValuableItem = {
  productId: string
  category: string
  condition: string
  gradingCompany: string | null
  grade: string | null
}

export type StockValuation = {
  purchaseCostCents: number
  estimatedValueCents: number
  latentGainCents: number
  valuedItemCount: number
  approximateItemCount: number
  unvaluedItemCount: number
  items: { stockItemId: string, valuation: StockItemValuation }[]
}

const heldStatuses = ['in-transit', 'in-stock']

export const estimateItemValues = async (
  database: KairosDatabase,
  valuableItems: ValuableItem[],
  now: Date,
): Promise<StockItemValuation[]> => {
  const snapshotsByProduct = await loadValuationSnapshots(
    database,
    [...new Set(valuableItems.map(valuableItem => valuableItem.productId))],
    now,
  )
  return valuableItems.map(valuableItem => estimateStockItemValue(
    {
      category: (isProductCategory(valuableItem.category) ? valuableItem.category : 'other') as ProductCategory,
      condition: valuableItem.condition as ConditionCode,
      gradingCompany: valuableItem.gradingCompany,
      grade: valuableItem.grade,
    },
    snapshotsByProduct.get(valuableItem.productId) ?? [],
    now,
  ))
}

export const valueStock = async (database: KairosDatabase, ownerId: string, now: Date): Promise<StockValuation> => {
  const heldItems = await database
    .select({
      stockItemId: stockItems.id,
      productId: stockItems.productId,
      category: products.category,
      condition: stockItems.condition,
      gradingCompany: stockItems.gradingCompany,
      grade: stockItems.grade,
      allocatedPurchaseCents: stockItems.allocatedPurchaseCents,
    })
    .from(stockItems)
    .innerJoin(products, eq(products.id, stockItems.productId))
    .where(and(eq(stockItems.ownerId, ownerId), inArray(stockItems.status, heldStatuses)))
  const valuations = await estimateItemValues(database, heldItems, now)
  const items = heldItems.map((heldItem, position) => ({
    stockItemId: heldItem.stockItemId,
    valuation: valuations[position]!,
  }))
  const valuedPositions = heldItems.flatMap((_, position) => valuations[position]!.valueCents === null ? [] : [position])
  const estimatedValueCents = valuedPositions.reduce((sum, position) => sum + valuations[position]!.valueCents!, 0)
  const valuedPurchaseCostCents = valuedPositions.reduce((sum, position) => sum + heldItems[position]!.allocatedPurchaseCents, 0)
  return {
    purchaseCostCents: heldItems.reduce((sum, heldItem) => sum + heldItem.allocatedPurchaseCents, 0),
    estimatedValueCents,
    latentGainCents: estimatedValueCents - valuedPurchaseCostCents,
    valuedItemCount: valuedPositions.length,
    approximateItemCount: valuedPositions.filter(position => valuations[position]!.approximate).length,
    unvaluedItemCount: heldItems.length - valuedPositions.length,
    items,
  }
}

export const recordStockValueSnapshots = async (database: KairosDatabase, now: Date): Promise<number> => {
  const snapshotOn = parisCalendarDateOf(now)
  const owners = await database.select({ id: users.id }).from(users)
  for (const owner of owners) {
    const stockValuation = await valueStock(database, owner.id, now)
    const figures = {
      purchaseCostCents: stockValuation.purchaseCostCents,
      estimatedValueCents: stockValuation.estimatedValueCents,
      valuedItemCount: stockValuation.valuedItemCount,
      approximateItemCount: stockValuation.approximateItemCount,
      unvaluedItemCount: stockValuation.unvaluedItemCount,
    }
    await database
      .insert(stockValueSnapshots)
      .values({ ownerId: owner.id, snapshotOn, ...figures })
      .onConflictDoUpdate({ target: [stockValueSnapshots.ownerId, stockValueSnapshots.snapshotOn], set: figures })
  }
  return owners.length
}
