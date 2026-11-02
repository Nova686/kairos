import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { persons, priceSnapshots, products, stockValueSnapshots, users } from '../../../server/database/schema/index.ts'
import { dashboardOverview } from '../../../server/domain/dashboard/dashboard-overview.ts'
import { createDebt } from '../../../server/domain/debts/debts-service.ts'
import { createSale } from '../../../server/domain/sales/sales-service.ts'
import { createPurchase } from '../../../server/domain/stock/purchases-service.ts'
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

const buy = async (
  database: KairosDatabase,
  ownerId: string,
  productId: string,
  priceCents: number,
  inTransit: boolean,
) => {
  const { stockItems: createdItems } = await createPurchase(database, ownerId, {
    purchasedOn: '2026-11-01',
    sellerLabel: null,
    totalPriceCents: priceCents,
    feesCents: 0,
    trackingReference: null,
    inTransit,
    lines: [{
      productId,
      condition: 'sealed-new',
      gradingCompany: null,
      grade: null,
      certificateNumber: null,
      locationId: null,
      allocatedPurchaseCents: priceCents,
    }],
  }, now)
  return createdItems[0]!.id
}

const sell = (
  database: KairosDatabase,
  ownerId: string,
  stockItemId: string,
  soldOn: string,
  totalPriceCents: number,
  trackingReference: string | null = null,
) =>
  createSale(database, ownerId, {
    soldOn,
    platform: 'Vinted',
    buyerPersonId: null,
    totalPriceCents,
    shippingIncluded: true,
    shippingCostCents: 0,
    platformFeesCents: 0,
    packagingCostCents: 0,
    trackingReference,
    stockItemIds: [stockItemId],
  }, now)

describe('dashboardOverview', () => {
  it('aggregates valuation, history, recent sales, deliveries and debts of one owner', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const otherOwnerId = await insertOwner(database, 'b@x.fr')
    const pricedProductId = await insertProduct(database, ownerId, 10000)
    const unpricedProductId = await insertProduct(database, ownerId, null)
    await buy(database, ownerId, pricedProductId, 6000, false)
    await buy(database, ownerId, unpricedProductId, 2000, true)
    const soldStockItemId = await buy(database, ownerId, pricedProductId, 3000, false)
    await sell(database, ownerId, soldStockItemId, '2026-11-02', 5000, 'TRACK-1')
    await buy(database, otherOwnerId, pricedProductId, 999, false)
    const [person] = await database.insert(persons).values({ ownerId, name: 'Camille' }).returning()
    await createDebt(database, ownerId, {
      personId: person!.id,
      amountCents: 2500,
      direction: 'owed-to-me',
      reason: 'Prêt',
      purchaseId: null,
      saleId: null,
      stockItemId: null,
      createdOn: '2026-11-02',
    })
    await database.insert(stockValueSnapshots).values([
      { ownerId, snapshotOn: '2026-10-01', purchaseCostCents: 100, estimatedValueCents: 200, valuedItemCount: 1, approximateItemCount: 0, unvaluedItemCount: 0 },
      { ownerId: otherOwnerId, snapshotOn: '2026-10-01', purchaseCostCents: 1, estimatedValueCents: 2, valuedItemCount: 1, approximateItemCount: 0, unvaluedItemCount: 0 },
    ])

    const overview = await dashboardOverview(database, ownerId, now)

    expect(overview.stockValue).toMatchObject({
      purchaseCostCents: 8000,
      estimatedValueCents: 10000,
      latentGainCents: 4000,
      valuedItemCount: 1,
      unvaluedItemCount: 1,
    })
    expect(overview.stockValue).not.toHaveProperty('items')
    expect(overview.valueHistory).toHaveLength(1)
    expect(overview.valueHistory[0]).toMatchObject({ snapshotOn: '2026-10-01', estimatedValueCents: 200 })
    expect(overview.recentSales).toHaveLength(1)
    expect(overview.recentSales[0]).toMatchObject({ soldOn: '2026-11-02', netProfitCents: 2000 })
    expect(overview.deliveriesInProgress).toEqual({ incoming: 1, outgoing: 1 })
    expect(overview.debtTotals).toEqual({ owedToMeCents: 2500, iOweCents: 0 })
  })

  it('keeps only the five most recent sales', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')
    const productId = await insertProduct(database, ownerId, null)
    for (let dayNumber = 1; dayNumber <= 6; dayNumber++) {
      const stockItemId = await buy(database, ownerId, productId, 1000, false)
      await sell(database, ownerId, stockItemId, `2026-10-0${dayNumber}`, 1500)
    }

    const overview = await dashboardOverview(database, ownerId, now)

    expect(overview.recentSales.map(recentSale => recentSale.soldOn)).toEqual([
      '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02',
    ])
  })

  it('returns zeros for an owner with nothing', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@x.fr')

    expect(await dashboardOverview(database, ownerId, now)).toEqual({
      stockValue: {
        purchaseCostCents: 0,
        estimatedValueCents: 0,
        latentGainCents: 0,
        valuedItemCount: 0,
        approximateItemCount: 0,
        unvaluedItemCount: 0,
      },
      valueHistory: [],
      recentSales: [],
      deliveriesInProgress: { incoming: 0, outgoing: 0 },
      debtTotals: { owedToMeCents: 0, iOweCents: 0 },
    })
  })
})
