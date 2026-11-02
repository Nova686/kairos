import { eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { debts, locations, persons, products, purchases, saleItems, sales, stockItems, users } from '../../../server/database/schema/index.ts'
import {
  createPurchase,
  deletePurchase,
  listPurchases,
  type PurchaseDraft,
} from '../../../server/domain/stock/purchases-service.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const insertProduct = async (database: KairosDatabase, createdByUserId: string, category: string): Promise<string> => {
  const [product] = await database.insert(products).values({ name: 'Display', category, createdByUserId }).returning()
  return product!.id
}

const insertLocation = async (database: KairosDatabase, ownerId: string, label: string): Promise<string> => {
  const [location] = await database.insert(locations).values({ ownerId, label }).returning()
  return location!.id
}

const buildDraft = (productId: string, lineCount: number, overrides: Partial<PurchaseDraft> = {}): PurchaseDraft => ({
  purchasedOn: '2026-11-02',
  sellerLabel: 'Vinted',
  totalPriceCents: 10000,
  feesCents: 450,
  trackingReference: null,
  inTransit: false,
  lines: Array.from({ length: lineCount }, () => ({
    productId,
    condition: 'sealed-new' as const,
    gradingCompany: null,
    grade: null,
    certificateNumber: null,
    locationId: null,
    allocatedPurchaseCents: null,
  })),
  ...overrides,
})

const expectStatus = async (action: Promise<unknown>, statusCode: number): Promise<void> => {
  await expect(action).rejects.toMatchObject({ statusCode })
}

describe('createPurchase', () => {
  it('splits price plus fees over three lines with the extra cent on the first', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')

    const { purchase, stockItems: createdStockItems } = await createPurchase(
      database,
      ownerId,
      buildDraft(productId, 3),
    )

    expect(createdStockItems.map(stockItem => stockItem.allocatedPurchaseCents)).toEqual([3484, 3483, 3483])
    expect(purchase.totalPriceCents).toBe(10000)
    expect(purchase.feesCents).toBe(450)
  })

  it('creates in-stock items received on the purchase date', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')

    const { stockItems: createdStockItems } = await createPurchase(database, ownerId, buildDraft(productId, 1))

    expect(createdStockItems[0]).toMatchObject({ status: 'in-stock', receivedOn: '2026-11-02', ownerId })
  })

  it('creates in-transit items without a reception date when the purchase is in transit', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')

    const { stockItems: createdStockItems } = await createPurchase(
      database,
      ownerId,
      buildDraft(productId, 2, { inTransit: true, trackingReference: 'XY123' }),
    )

    expect(createdStockItems.map(stockItem => [stockItem.status, stockItem.receivedOn])).toEqual([
      ['in-transit', null],
      ['in-transit', null],
    ])
  })

  it('keeps explicit allocations that sum to price plus fees', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const draft = buildDraft(productId, 2)
    draft.lines[0]!.allocatedPurchaseCents = 7000
    draft.lines[1]!.allocatedPurchaseCents = 3450

    const { stockItems: createdStockItems } = await createPurchase(database, ownerId, draft)

    expect(createdStockItems.map(stockItem => stockItem.allocatedPurchaseCents)).toEqual([7000, 3450])
  })

  it('answers 422 when explicit allocations do not sum to price plus fees', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const draft = buildDraft(productId, 2)
    draft.lines[0]!.allocatedPurchaseCents = 7000
    draft.lines[1]!.allocatedPurchaseCents = 3000

    await expectStatus(createPurchase(database, ownerId, draft), 422)
  })

  it('answers 422 when allocations are given on some lines only', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const draft = buildDraft(productId, 2)
    draft.lines[0]!.allocatedPurchaseCents = 7000

    await expectStatus(createPurchase(database, ownerId, draft), 422)
  })

  it('answers 422 for a condition the category does not allow', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const draft = buildDraft(productId, 1)
    draft.lines[0]!.condition = 'good'

    await expectStatus(createPurchase(database, ownerId, draft), 422)
  })

  it('answers 422 for a purchase without lines', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')

    await expectStatus(createPurchase(database, ownerId, buildDraft(productId, 0)), 422)
  })

  it('answers 404 for an unknown product', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')

    await expectStatus(createPurchase(database, ownerId, buildDraft('00000000-0000-4000-8000-000000000000', 1)), 404)
  })

  it('answers 404 for a location owned by another user', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const foreignLocationId = await insertLocation(database, otherOwnerId, 'Cave')
    const draft = buildDraft(productId, 1)
    draft.lines[0]!.locationId = foreignLocationId

    await expectStatus(createPurchase(database, ownerId, draft), 404)
  })

  it('stores the owned location on the stock item', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const locationId = await insertLocation(database, ownerId, 'Cave')
    const draft = buildDraft(productId, 1)
    draft.lines[0]!.locationId = locationId

    const { stockItems: createdStockItems } = await createPurchase(database, ownerId, draft)

    expect(createdStockItems[0]!.locationId).toBe(locationId)
  })

  it('requires grading company and grade for a graded card', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'graded-card')
    const draft = buildDraft(productId, 1)
    draft.lines[0]!.condition = 'graded'

    await expectStatus(createPurchase(database, ownerId, draft), 422)
    draft.lines[0]!.gradingCompany = 'PSA'
    await expectStatus(createPurchase(database, ownerId, draft), 422)
    draft.lines[0]!.grade = ' '
    await expectStatus(createPurchase(database, ownerId, draft), 422)
  })

  it('keeps the grading fields of a graded card', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'graded-card')
    const draft = buildDraft(productId, 1)
    draft.lines[0]!.condition = 'graded'
    draft.lines[0]!.gradingCompany = 'PSA'
    draft.lines[0]!.grade = '10'
    draft.lines[0]!.certificateNumber = '123456'

    const { stockItems: createdStockItems } = await createPurchase(database, ownerId, draft)

    expect(createdStockItems[0]).toMatchObject({ gradingCompany: 'PSA', grade: '10', certificateNumber: '123456' })
  })

  it('answers 422 when a non-graded product carries grading fields', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const draft = buildDraft(productId, 1)
    draft.lines[0]!.gradingCompany = 'PSA'

    await expectStatus(createPurchase(database, ownerId, draft), 422)
  })

  it('writes nothing when a later line is invalid', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const draft = buildDraft(productId, 2)
    draft.lines[1]!.condition = 'good'

    await expectStatus(createPurchase(database, ownerId, draft), 422)

    expect(await database.select().from(purchases)).toEqual([])
    expect(await database.select().from(stockItems)).toEqual([])
  })
})

describe('listPurchases', () => {
  it('lists the purchases of the owner only', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    await createPurchase(database, ownerId, buildDraft(productId, 1))
    await createPurchase(database, otherOwnerId, buildDraft(productId, 1))

    const ownedPurchases = await listPurchases(database, ownerId)

    expect(ownedPurchases).toHaveLength(1)
    expect(ownedPurchases[0]!.ownerId).toBe(ownerId)
  })
})

describe('deletePurchase', () => {
  it('deletes the items then the purchase', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const { purchase } = await createPurchase(database, ownerId, buildDraft(productId, 2))

    await deletePurchase(database, ownerId, purchase.id)

    expect(await database.select().from(purchases)).toEqual([])
    expect(await database.select().from(stockItems)).toEqual([])
  })

  it('answers 409 when one of its items is sold', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const { purchase, stockItems: createdStockItems } = await createPurchase(database, ownerId, buildDraft(productId, 2))
    await database.update(stockItems).set({ status: 'sold' }).where(eq(stockItems.id, createdStockItems[0]!.id))

    await expectStatus(deletePurchase(database, ownerId, purchase.id), 409)

    expect(await database.select().from(stockItems)).toHaveLength(2)
  })

  it('answers 409 when one of its items belongs to a sale even if not marked sold', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const { purchase, stockItems: createdStockItems } = await createPurchase(database, ownerId, buildDraft(productId, 1))
    const [sale] = await database
      .insert(sales)
      .values({ ownerId, soldOn: '2026-11-03', platform: 'Vinted', totalPriceCents: 5000, shippingIncluded: false })
      .returning()
    await database.insert(saleItems).values({
      saleId: sale!.id,
      stockItemId: createdStockItems[0]!.id,
      allocatedSaleCents: 5000,
    })

    await expectStatus(deletePurchase(database, ownerId, purchase.id), 409)
  })

  it('deletes the unsettled debts linked to the purchase or to its items', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const { purchase, stockItems: createdStockItems } = await createPurchase(database, ownerId, buildDraft(productId, 1))
    const [person] = await database.insert(persons).values({ ownerId, name: 'Camille' }).returning()
    await database.insert(debts).values([
      { ownerId, personId: person!.id, amountCents: 500, direction: 'i-owe', reason: 'Avancé', purchaseId: purchase.id, createdOn: '2026-11-02' },
      { ownerId, personId: person!.id, amountCents: 700, direction: 'i-owe', reason: 'Avancé', stockItemId: createdStockItems[0]!.id, createdOn: '2026-11-02' },
    ])

    await deletePurchase(database, ownerId, purchase.id)

    expect(await database.select().from(debts)).toEqual([])
    expect(await database.select().from(purchases)).toEqual([])
    expect(await database.select().from(stockItems)).toEqual([])
  })

  it('answers 409 and deletes nothing when a linked debt is settled', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const { purchase } = await createPurchase(database, ownerId, buildDraft(productId, 1))
    const [person] = await database.insert(persons).values({ ownerId, name: 'Camille' }).returning()
    await database.insert(debts).values([
      { ownerId, personId: person!.id, amountCents: 500, direction: 'i-owe', reason: 'Avancé', purchaseId: purchase.id, createdOn: '2026-11-02', settledOn: '2026-11-03' },
      { ownerId, personId: person!.id, amountCents: 700, direction: 'i-owe', reason: 'Avancé', purchaseId: purchase.id, createdOn: '2026-11-02' },
    ])

    await expectStatus(deletePurchase(database, ownerId, purchase.id), 409)

    expect(await database.select().from(debts)).toHaveLength(2)
    expect(await database.select().from(purchases)).toHaveLength(1)
    expect(await database.select().from(stockItems)).toHaveLength(1)
  })

  it('answers 404 for the purchase of another user', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'pokemon-sealed')
    const { purchase } = await createPurchase(database, ownerId, buildDraft(productId, 1))

    await expectStatus(deletePurchase(database, otherOwnerId, purchase.id), 404)
  })
})
