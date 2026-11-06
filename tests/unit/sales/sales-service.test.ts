import { eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { debts, persons, products, saleItems, sales, stockItems, users } from '../../../server/database/schema/index.ts'
import { createPurchase } from '../../../server/domain/stock/purchases-service.ts'
import {
  createSale,
  deleteSale,
  listSales,
  markSaleDelivered,
  type SaleDraft,
} from '../../../server/domain/sales/sales-service.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const insertProduct = async (database: KairosDatabase, createdByUserId: string): Promise<string> => {
  const [product] = await database.insert(products).values({ name: 'Display', category: 'pokemon-sealed', createdByUserId }).returning()
  return product!.id
}

const insertPerson = async (database: KairosDatabase, ownerId: string): Promise<string> => {
  const [person] = await database.insert(persons).values({ ownerId, name: 'Acheteur' }).returning()
  return person!.id
}

const stockWithAllocations = async (
  database: KairosDatabase,
  ownerId: string,
  productId: string,
  allocations: number[],
  inTransit = false,
): Promise<string[]> => {
  const { stockItems: createdStockItems } = await createPurchase(database, ownerId, {
    purchasedOn: '2026-11-01',
    sellerLabel: null,
    totalPriceCents: allocations.reduce((sum, allocation) => sum + allocation, 0),
    feesCents: 0,
    trackingReference: null,
    inTransit,
    lines: allocations.map(allocation => ({
      productId,
      condition: 'sealed-new' as const,
      gradingCompany: null,
      grade: null,
      certificateNumber: null,
      locationId: null,
      allocatedPurchaseCents: allocation,
    })),
  })
  return createdStockItems.map(stockItem => stockItem.id)
}

const buildSaleDraft = (stockItemIds: string[], overrides: Partial<SaleDraft> = {}): SaleDraft => ({
  soldOn: '2026-11-02',
  platform: 'Vinted',
  buyerPersonId: null,
  totalPriceCents: 10000,
  shippingIncluded: true,
  shippingCostCents: 600,
  platformFeesCents: 800,
  packagingCostCents: 100,
  trackingReference: null,
  stockItemIds,
  ...overrides,
})

const expectStatus = async (action: Promise<unknown>, statusCode: number): Promise<void> => {
  await expect(action).rejects.toMatchObject({ statusCode })
}

describe('createSale', () => {
  it('allocates the net sale over a lot by purchase cost and computes profits', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const stockItemIds = await stockWithAllocations(database, ownerId, productId, [3000, 1000])

    const { sale, saleItems: createdSaleItems } = await createSale(
      database,
      ownerId,
      buildSaleDraft(stockItemIds, { totalPriceCents: 8000 + 800 + 100 + 600 }),
    )

    expect(sale.ownerId).toBe(ownerId)
    expect(createdSaleItems.map(saleItem => saleItem.allocatedSaleCents)).toEqual([6000, 2000])
    const [listed] = await listSales(database, ownerId)
    expect(listed!.saleNetCents).toBe(8000)
    expect(listed!.items.map(saleItem => saleItem.netProfitCents)).toEqual([3000, 1000])
    expect(listed!.netProfitCents).toBe(4000)
  })

  it('marks items sold, or sold-in-transit when a tracking reference is given', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [directId, trackedId] = await stockWithAllocations(database, ownerId, productId, [1000, 1000])

    await createSale(database, ownerId, buildSaleDraft([directId!]))
    await createSale(database, ownerId, buildSaleDraft([trackedId!], { trackingReference: 'LP123' }))

    const [direct] = await database.select().from(stockItems).where(eq(stockItems.id, directId!))
    const [tracked] = await database.select().from(stockItems).where(eq(stockItems.id, trackedId!))
    expect(direct!.status).toBe('sold')
    expect(tracked!.status).toBe('sold-in-transit')
  })

  it('allows a negative net and keeps shares summing to it', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const stockItemIds = await stockWithAllocations(database, ownerId, productId, [100, 100, 100])

    const { saleItems: createdSaleItems } = await createSale(
      database,
      ownerId,
      buildSaleDraft(stockItemIds, { totalPriceCents: 0, platformFeesCents: 1001, packagingCostCents: 0, shippingCostCents: 0 }),
    )

    const shares = createdSaleItems.map(saleItem => saleItem.allocatedSaleCents)
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(-1001)
  })

  it('refuses an item that is not in stock with 409', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [inTransitId] = await stockWithAllocations(database, ownerId, productId, [1000], true)

    await expectStatus(createSale(database, ownerId, buildSaleDraft([inTransitId!])), 409)
  })

  it('refuses an item already sold with 409', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    await createSale(database, ownerId, buildSaleDraft([stockItemId!]))

    await expectStatus(createSale(database, ownerId, buildSaleDraft([stockItemId!])), 409)
  })

  it('answers 404 for another owner item or buyer, and 422 for a duplicated or empty list', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const otherPersonId = await insertPerson(database, otherOwnerId)

    await expectStatus(createSale(database, otherOwnerId, buildSaleDraft([stockItemId!])), 404)
    await expectStatus(createSale(database, ownerId, buildSaleDraft([stockItemId!], { buyerPersonId: otherPersonId })), 404)
    await expectStatus(createSale(database, ownerId, buildSaleDraft([stockItemId!, stockItemId!])), 422)
    await expectStatus(createSale(database, ownerId, buildSaleDraft([])), 422)
    const [untouched] = await database.select().from(stockItems).where(eq(stockItems.id, stockItemId!))
    expect(untouched!.status).toBe('in-stock')
  })

  it('rolls back everything when one item is refused', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const [transitId] = await stockWithAllocations(database, ownerId, productId, [1000], true)

    await expectStatus(createSale(database, ownerId, buildSaleDraft([stockId!, transitId!])), 409)

    expect(await database.select().from(sales)).toHaveLength(0)
    const [stillInStock] = await database.select().from(stockItems).where(eq(stockItems.id, stockId!))
    expect(stillInStock!.status).toBe('in-stock')
  })
})

describe('markSaleDelivered', () => {
  it('sets deliveredOn and turns sold-in-transit items into sold', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!], { trackingReference: 'LP1' }))

    const delivered = await markSaleDelivered(database, ownerId, sale.id, '2026-11-05')

    expect(delivered.deliveredOn).toBe('2026-11-05')
    const [stockItem] = await database.select().from(stockItems).where(eq(stockItems.id, stockItemId!))
    expect(stockItem!.status).toBe('sold')
  })

  it('answers 422 for a delivery dated before the sale and keeps the items in transit', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!], { trackingReference: 'LP1' }))

    await expectStatus(markSaleDelivered(database, ownerId, sale.id, '2026-11-01'), 422)

    const [storedSale] = await database.select().from(sales).where(eq(sales.id, sale.id))
    const [stockItem] = await database.select().from(stockItems).where(eq(stockItems.id, stockItemId!))
    expect(storedSale!.deliveredOn).toBeNull()
    expect(stockItem!.status).toBe('sold-in-transit')
  })

  it('only sets deliveredOn on a sale without tracking', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!]))

    const delivered = await markSaleDelivered(database, ownerId, sale.id, '2026-11-05')

    expect(delivered.deliveredOn).toBe('2026-11-05')
    const [stockItem] = await database.select().from(stockItems).where(eq(stockItems.id, stockItemId!))
    expect(stockItem!.status).toBe('sold')
  })

  it('answers 404 for another owner sale', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!]))

    await expectStatus(markSaleDelivered(database, otherOwnerId, sale.id, '2026-11-05'), 404)
  })
})

describe('deleteSale', () => {
  it('returns items to in-stock and removes sale rows and unsettled linked debts', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const personId = await insertPerson(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!], { trackingReference: 'LP1' }))
    await database.insert(debts).values({
      ownerId, personId, amountCents: 500, direction: 'owed-to-me', reason: 'reste', saleId: sale.id, createdOn: '2026-11-02',
    })

    await deleteSale(database, ownerId, sale.id)

    const [stockItem] = await database.select().from(stockItems).where(eq(stockItems.id, stockItemId!))
    expect(stockItem!.status).toBe('in-stock')
    expect(await database.select().from(sales)).toHaveLength(0)
    expect(await database.select().from(saleItems)).toHaveLength(0)
    expect(await database.select().from(debts)).toHaveLength(0)
  })

  it('refuses with 409 when a linked debt is settled and changes nothing', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId)
    const personId = await insertPerson(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!]))
    await database.insert(debts).values({
      ownerId, personId, amountCents: 500, direction: 'owed-to-me', reason: 'reste', saleId: sale.id, createdOn: '2026-11-02', settledOn: '2026-11-03',
    })

    await expectStatus(deleteSale(database, ownerId, sale.id), 409)

    expect(await database.select().from(sales)).toHaveLength(1)
    const [stockItem] = await database.select().from(stockItems).where(eq(stockItems.id, stockItemId!))
    expect(stockItem!.status).toBe('sold')
  })

  it('answers 404 for another owner sale', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId)
    const [stockItemId] = await stockWithAllocations(database, ownerId, productId, [1000])
    const { sale } = await createSale(database, ownerId, buildSaleDraft([stockItemId!]))

    await expectStatus(deleteSale(database, otherOwnerId, sale.id), 404)
  })
})

describe('listSales', () => {
  it('lists only the owner sales, most recent first', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId)
    const [firstId, secondId] = await stockWithAllocations(database, ownerId, productId, [1000, 1000])
    const [otherStockId] = await stockWithAllocations(database, otherOwnerId, productId, [1000])
    await createSale(database, ownerId, buildSaleDraft([firstId!], { soldOn: '2026-10-01' }))
    await createSale(database, ownerId, buildSaleDraft([secondId!], { soldOn: '2026-11-01' }))
    await createSale(database, otherOwnerId, buildSaleDraft([otherStockId!]))

    const listed = await listSales(database, ownerId)

    expect(listed.map(sale => sale.soldOn)).toEqual(['2026-11-01', '2026-10-01'])
  })
})
