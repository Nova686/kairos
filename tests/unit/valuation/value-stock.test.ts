import { eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { priceSnapshots, products, stockItems, stockValueSnapshots, users } from '../../../server/database/schema/index.ts'
import { createPurchase, type PurchaseLineDraft } from '../../../server/domain/stock/purchases-service.ts'
import { createSale } from '../../../server/domain/sales/sales-service.ts'
import { recordStockValueSnapshots, valueStock } from '../../../server/domain/valuation/value-stock.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const insertProduct = async (database: KairosDatabase, createdByUserId: string, valueCents: number | null): Promise<string> => {
  const [product] = await database.insert(products).values({ name: 'Display', category: 'pokemon-sealed', createdByUserId }).returning()
  if (valueCents !== null) {
    await database.insert(priceSnapshots).values({
      productId: product!.id,
      source: 'ebay',
      kind: 'sold',
      kairosCondition: 'sealed-new',
      medianCents: valueCents,
      observedAt: now,
    })
  }
  return product!.id
}

const line = (productId: string, allocatedPurchaseCents: number | null): PurchaseLineDraft => ({
  productId,
  condition: 'sealed-new',
  gradingCompany: null,
  grade: null,
  certificateNumber: null,
  locationId: null,
  allocatedPurchaseCents,
})

const buy = (database: KairosDatabase, ownerId: string, totalPriceCents: number, lines: PurchaseLineDraft[], inTransit = false) =>
  createPurchase(database, ownerId, {
    purchasedOn: '2026-11-01',
    sellerLabel: null,
    totalPriceCents,
    feesCents: 0,
    trackingReference: null,
    inTransit,
    lines,
  }, now)

describe('valueStock', () => {
  it('sums valued items only and never counts an unvalued item as zero', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const firstProductId = await insertProduct(database, ownerId, 10000)
    const secondProductId = await insertProduct(database, ownerId, 5000)
    const unvaluedProductId = await insertProduct(database, ownerId, null)
    await buy(database, ownerId, 6000, [line(firstProductId, 6000)])
    await buy(database, ownerId, 4000, [line(secondProductId, 4000)], true)
    await buy(database, ownerId, 3000, [line(unvaluedProductId, 3000)])

    const stockValuation = await valueStock(database, ownerId, now)

    expect(stockValuation).toMatchObject({
      purchaseCostCents: 13000,
      valuedPurchaseCostCents: 10000,
      estimatedValueCents: 15000,
      latentGainCents: 5000,
      valuedItemCount: 2,
      approximateItemCount: 0,
      unvaluedItemCount: 1,
    })
    expect(stockValuation.items).toHaveLength(3)
  })

  it('ignores sold items and other owners', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const otherOwnerId = await insertOwner(database, 'b@x.fr')
    const productId = await insertProduct(database, ownerId, 10000)
    const { stockItems: soldItems } = await buy(database, ownerId, 6000, [line(productId, 6000)])
    await database.update(stockItems).set({ status: 'sold' }).where(eq(stockItems.id, soldItems[0]!.id))
    await buy(database, otherOwnerId, 1000, [line(productId, 1000)])

    expect(await valueStock(database, ownerId, now)).toMatchObject({
      purchaseCostCents: 0,
      estimatedValueCents: 0,
      unvaluedItemCount: 0,
      items: [],
    })
  })
})

describe('recordStockValueSnapshots', () => {
  it('writes one row per user and day even when recorded twice, zeros for an empty stock', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const emptyOwnerId = await insertOwner(database, 'b@x.fr')
    const productId = await insertProduct(database, ownerId, 10000)
    const unvaluedProductId = await insertProduct(database, ownerId, null)
    await buy(database, ownerId, 6000, [line(productId, 6000)])
    await buy(database, ownerId, 2500, [line(unvaluedProductId, 2500)])

    await recordStockValueSnapshots(database, now)
    await recordStockValueSnapshots(database, new Date('2026-11-02T18:00:00Z'))

    const rows = await database.select().from(stockValueSnapshots)
    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.ownerId === ownerId)).toMatchObject({
      snapshotOn: '2026-11-02',
      purchaseCostCents: 8500,
      valuedPurchaseCostCents: 6000,
      estimatedValueCents: 10000,
      valuedItemCount: 1,
      unvaluedItemCount: 1,
    })
    expect(rows.find(row => row.ownerId === emptyOwnerId)).toMatchObject({
      purchaseCostCents: 0,
      valuedPurchaseCostCents: 0,
      estimatedValueCents: 0,
      valuedItemCount: 0,
      unvaluedItemCount: 0,
    })
  })

  it('uses the Paris calendar day of the moment', async () => {
    const database = await createTestDatabase()
    await insertOwner(database, 'a@x.fr')

    await recordStockValueSnapshots(database, new Date('2026-11-02T23:30:00Z'))

    expect((await database.select().from(stockValueSnapshots))[0]!.snapshotOn).toBe('2026-11-03')
  })
})

describe('value-based lot allocation', () => {
  it('splits a purchase by estimated value when every line has one', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const richProductId = await insertProduct(database, ownerId, 15000)
    const poorProductId = await insertProduct(database, ownerId, 5000)

    const { stockItems: createdItems } = await buy(database, ownerId, 10000, [line(richProductId, null), line(poorProductId, null)])

    expect(createdItems.map(stockItem => stockItem.allocatedPurchaseCents)).toEqual([7500, 2500])
  })

  it('splits equally when one line has no estimated value', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const richProductId = await insertProduct(database, ownerId, 15000)
    const unvaluedProductId = await insertProduct(database, ownerId, null)

    const { stockItems: createdItems } = await buy(database, ownerId, 10000, [line(richProductId, null), line(unvaluedProductId, null)])

    expect(createdItems.map(stockItem => stockItem.allocatedPurchaseCents)).toEqual([5000, 5000])
  })

  it('splits a sale by estimated value when every item has one, else by purchase cost', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const richProductId = await insertProduct(database, ownerId, 15000)
    const poorProductId = await insertProduct(database, ownerId, 5000)
    const unvaluedProductId = await insertProduct(database, ownerId, null)
    const { stockItems: valuedItems } = await buy(database, ownerId, 4000, [line(richProductId, 1000), line(poorProductId, 3000)])
    const { stockItems: mixedItems } = await buy(database, ownerId, 4000, [line(richProductId, 1000), line(unvaluedProductId, 3000)])
    const draft = {
      soldOn: '2026-11-02',
      platform: 'Vinted',
      buyerPersonId: null,
      totalPriceCents: 10000,
      shippingIncluded: false,
      shippingCostCents: 0,
      platformFeesCents: 0,
      packagingCostCents: 0,
      trackingReference: null,
    }

    const valuedSale = await createSale(database, ownerId, { ...draft, stockItemIds: valuedItems.map(stockItem => stockItem.id) }, now)
    const mixedSale = await createSale(database, ownerId, { ...draft, stockItemIds: mixedItems.map(stockItem => stockItem.id) }, now)

    expect(valuedSale.saleItems.map(saleItem => saleItem.allocatedSaleCents)).toEqual([7500, 2500])
    expect(mixedSale.saleItems.map(saleItem => saleItem.allocatedSaleCents)).toEqual([2500, 7500])
  })
})
