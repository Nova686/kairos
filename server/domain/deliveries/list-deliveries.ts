import { and, asc, eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { products, purchases, saleItems, sales, stockItems } from '../../database/schema/index.ts'

export type IncomingDelivery = {
  stockItemId: string
  productName: string
  trackingReference: string | null
  purchasedOn: string
}

export type OutgoingDelivery = {
  saleId: string
  productNames: string[]
  trackingReference: string | null
  soldOn: string
}

export type Deliveries = {
  incoming: IncomingDelivery[]
  outgoing: OutgoingDelivery[]
}

export const listDeliveries = async (database: KairosDatabase, ownerId: string): Promise<Deliveries> => {
  const incoming = await database
    .select({
      stockItemId: stockItems.id,
      productName: products.name,
      trackingReference: purchases.trackingReference,
      purchasedOn: purchases.purchasedOn,
    })
    .from(stockItems)
    .innerJoin(products, eq(products.id, stockItems.productId))
    .innerJoin(purchases, eq(purchases.id, stockItems.purchaseId))
    .where(and(eq(stockItems.ownerId, ownerId), eq(stockItems.status, 'in-transit')))
    .orderBy(asc(purchases.purchasedOn), asc(stockItems.id))

  const outgoingRows = await database
    .select({
      saleId: sales.id,
      productName: products.name,
      trackingReference: sales.trackingReference,
      soldOn: sales.soldOn,
    })
    .from(sales)
    .innerJoin(saleItems, eq(saleItems.saleId, sales.id))
    .innerJoin(stockItems, eq(stockItems.id, saleItems.stockItemId))
    .innerJoin(products, eq(products.id, stockItems.productId))
    .where(and(eq(sales.ownerId, ownerId), eq(stockItems.status, 'sold-in-transit')))
    .orderBy(asc(sales.soldOn), asc(sales.id), asc(products.name))

  const outgoingBySaleId = new Map<string, OutgoingDelivery>()
  for (const outgoingRow of outgoingRows) {
    const outgoingDelivery = outgoingBySaleId.get(outgoingRow.saleId) ?? {
      saleId: outgoingRow.saleId,
      productNames: [],
      trackingReference: outgoingRow.trackingReference,
      soldOn: outgoingRow.soldOn,
    }
    outgoingDelivery.productNames.push(outgoingRow.productName)
    outgoingBySaleId.set(outgoingRow.saleId, outgoingDelivery)
  }

  return { incoming, outgoing: [...outgoingBySaleId.values()] }
}
