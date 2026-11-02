import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { products, users } from '../../../server/database/schema/index.ts'
import { listDeliveries } from '../../../server/domain/deliveries/list-deliveries.ts'
import { createSale, markSaleDelivered } from '../../../server/domain/sales/sales-service.ts'
import { createPurchase } from '../../../server/domain/stock/purchases-service.ts'
import { receiveStockItem } from '../../../server/domain/stock/stock-items-service.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const insertProduct = async (database: KairosDatabase, createdByUserId: string, name: string): Promise<string> => {
  const [product] = await database.insert(products).values({ name, category: 'pokemon-sealed', createdByUserId }).returning()
  return product!.id
}

const purchaseOne = async (
  database: KairosDatabase,
  ownerId: string,
  productId: string,
  options: { inTransit: boolean, trackingReference: string | null },
): Promise<string> => {
  const { stockItems } = await createPurchase(database, ownerId, {
    purchasedOn: '2026-11-01',
    sellerLabel: null,
    totalPriceCents: 1000,
    feesCents: 0,
    trackingReference: options.trackingReference,
    inTransit: options.inTransit,
    lines: [{
      productId,
      condition: 'sealed-new' as const,
      gradingCompany: null,
      grade: null,
      certificateNumber: null,
      locationId: null,
      allocatedPurchaseCents: 1000,
    }],
  })
  return stockItems[0]!.id
}

const sellItems = (database: KairosDatabase, ownerId: string, stockItemIds: string[], trackingReference: string | null) =>
  createSale(database, ownerId, {
    soldOn: '2026-11-03',
    platform: 'Vinted',
    buyerPersonId: null,
    totalPriceCents: 5000,
    shippingIncluded: false,
    shippingCostCents: 0,
    platformFeesCents: 0,
    packagingCostCents: 0,
    trackingReference,
    stockItemIds,
  })

describe('listDeliveries', () => {
  it('lists in-transit purchases and tracked sales, then empties after receive and delivered', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const displayId = await insertProduct(database, ownerId, 'Display')
    const boxId = await insertProduct(database, ownerId, 'Coffret')
    const incomingStockItemId = await purchaseOne(database, ownerId, displayId, { inTransit: true, trackingReference: 'https://suivi.example/1' })
    const soldFirstId = await purchaseOne(database, ownerId, displayId, { inTransit: false, trackingReference: null })
    const soldSecondId = await purchaseOne(database, ownerId, boxId, { inTransit: false, trackingReference: null })
    const { sale } = await sellItems(database, ownerId, [soldFirstId, soldSecondId], 'LP123')

    const deliveries = await listDeliveries(database, ownerId)

    expect(deliveries.incoming).toEqual([
      { stockItemId: incomingStockItemId, productName: 'Display', trackingReference: 'https://suivi.example/1', purchasedOn: '2026-11-01' },
    ])
    expect(deliveries.outgoing).toHaveLength(1)
    expect(deliveries.outgoing[0]).toMatchObject({ saleId: sale.id, trackingReference: 'LP123', soldOn: '2026-11-03' })
    expect([...deliveries.outgoing[0]!.productNames].sort()).toEqual(['Coffret', 'Display'])

    await receiveStockItem(database, ownerId, incomingStockItemId, '2026-11-04')
    await markSaleDelivered(database, ownerId, sale.id, '2026-11-05')

    expect(await listDeliveries(database, ownerId)).toEqual({ incoming: [], outgoing: [] })
  })

  it('ignores sales without tracking and rows of other owners', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'Display')
    const otherProductId = await insertProduct(database, otherOwnerId, 'Autre')
    const directlySoldId = await purchaseOne(database, ownerId, productId, { inTransit: false, trackingReference: null })
    await sellItems(database, ownerId, [directlySoldId], null)
    await purchaseOne(database, otherOwnerId, otherProductId, { inTransit: true, trackingReference: 'X' })

    expect(await listDeliveries(database, ownerId)).toEqual({ incoming: [], outgoing: [] })
  })
})
