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
  valuedPurchaseCostCents: number
  estimatedValueCents: number
  latentGainCents: number
  valuedItemCount: number
  approximateItemCount: number
  unvaluedItemCount: number
  items: { stockItemId: string, valuation: StockItemValuation }[]
}

const heldStatuses = ['in-transit', 'in-stock']

type ValuationLogger = (...details: unknown[]) => void

const unvalued: StockItemValuation = { valueCents: null, approximate: false, usedCondition: null, perSource: [] }

const valuedStockItemOf = (valuableItem: ValuableItem, category: ProductCategory) => ({
  category,
  condition: valuableItem.condition as ConditionCode,
  gradingCompany: valuableItem.gradingCompany,
  grade: valuableItem.grade,
})

export const estimateItemValues = async (
  database: KairosDatabase,
  valuableItems: ValuableItem[],
  now: Date,
  logUnknownCategory: ValuationLogger = console.error,
): Promise<StockItemValuation[]> => {
  const snapshotsByProduct = await loadValuationSnapshots(
    database,
    [...new Set(valuableItems.map(valuableItem => valuableItem.productId))],
    now,
  )
  return valuableItems.map((valuableItem) => {
    if (!isProductCategory(valuableItem.category)) {
      logUnknownCategory('Unknown product category, item left unvalued', valuableItem.productId, valuableItem.category)
      return unvalued
    }
    return estimateStockItemValue(
      valuedStockItemOf(valuableItem, valuableItem.category),
      snapshotsByProduct.get(valuableItem.productId) ?? [],
      now,
    )
  })
}

export const valueStock = async (
  database: KairosDatabase,
  ownerId: string,
  now: Date,
  logUnknownCategory: ValuationLogger = console.error,
): Promise<StockValuation> => {
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
  const valuations = await estimateItemValues(database, heldItems, now, logUnknownCategory)
  const items = heldItems.map((heldItem, position) => ({
    stockItemId: heldItem.stockItemId,
    valuation: valuations[position]!,
  }))
  const valuedPositions = heldItems.flatMap((_, position) => valuations[position]!.valueCents === null ? [] : [position])
  const estimatedValueCents = valuedPositions.reduce((sum, position) => sum + valuations[position]!.valueCents!, 0)
  const valuedPurchaseCostCents = valuedPositions.reduce((sum, position) => sum + heldItems[position]!.allocatedPurchaseCents, 0)
  return {
    purchaseCostCents: heldItems.reduce((sum, heldItem) => sum + heldItem.allocatedPurchaseCents, 0),
    valuedPurchaseCostCents,
    estimatedValueCents,
    latentGainCents: estimatedValueCents - valuedPurchaseCostCents,
    valuedItemCount: valuedPositions.length,
    approximateItemCount: valuedPositions.filter(position => valuations[position]!.approximate).length,
    unvaluedItemCount: heldItems.length - valuedPositions.length,
    items,
  }
}

export type RecordStockValueDependencies = {
  valueOwnerStock?: (database: KairosDatabase, ownerId: string, now: Date) => Promise<StockValuation>
  logFailure?: ValuationLogger
}

const recordOwnerStockValue = async (
  database: KairosDatabase,
  ownerId: string,
  now: Date,
  valueOwnerStock: NonNullable<RecordStockValueDependencies['valueOwnerStock']>,
): Promise<void> => {
  const stockValuation = await valueOwnerStock(database, ownerId, now)
  const figures = {
    purchaseCostCents: stockValuation.purchaseCostCents,
    valuedPurchaseCostCents: stockValuation.valuedPurchaseCostCents,
    estimatedValueCents: stockValuation.estimatedValueCents,
    valuedItemCount: stockValuation.valuedItemCount,
    approximateItemCount: stockValuation.approximateItemCount,
    unvaluedItemCount: stockValuation.unvaluedItemCount,
  }
  await database
    .insert(stockValueSnapshots)
    .values({ ownerId, snapshotOn: parisCalendarDateOf(now), ...figures })
    .onConflictDoUpdate({ target: [stockValueSnapshots.ownerId, stockValueSnapshots.snapshotOn], set: figures })
}

export const recordStockValueSnapshots = async (
  database: KairosDatabase,
  now: Date,
  { valueOwnerStock = valueStock, logFailure = console.error }: RecordStockValueDependencies = {},
): Promise<number> => {
  const owners = await database.select({ id: users.id }).from(users)
  let recordedOwnerCount = 0
  for (const owner of owners) {
    try {
      await recordOwnerStockValue(database, owner.id, now, valueOwnerStock)
      recordedOwnerCount += 1
    }
    catch (error) {
      logFailure('Stock value snapshot failed', owner.id, error)
    }
  }
  return recordedOwnerCount
}
