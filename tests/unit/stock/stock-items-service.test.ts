import { eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { locations, products, users } from '../../../server/database/schema/index.ts'
import { createPurchase } from '../../../server/domain/stock/purchases-service.ts'
import {
  findStockItem,
  listStockItems,
  receiveStockItem,
  updateStockItem,
} from '../../../server/domain/stock/stock-items-service.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const insertProduct = async (
  database: KairosDatabase,
  createdByUserId: string,
  name: string,
  category: string,
): Promise<string> => {
  const [product] = await database.insert(products).values({ name, category, createdByUserId }).returning()
  return product!.id
}

const insertLocation = async (database: KairosDatabase, ownerId: string, label: string): Promise<string> => {
  const [location] = await database.insert(locations).values({ ownerId, label }).returning()
  return location!.id
}

const buyOne = async (
  database: KairosDatabase,
  ownerId: string,
  productId: string,
  options: { inTransit?: boolean, condition?: 'sealed-new' | 'graded' | 'good', locationId?: string } = {},
) => {
  const { stockItems: createdStockItems } = await createPurchase(database, ownerId, {
    purchasedOn: '2026-11-02',
    sellerLabel: null,
    totalPriceCents: 1000,
    feesCents: 0,
    trackingReference: null,
    inTransit: options.inTransit ?? false,
    lines: [{
      productId,
      condition: options.condition ?? 'sealed-new',
      gradingCompany: options.condition === 'graded' ? 'PSA' : null,
      grade: options.condition === 'graded' ? '10' : null,
      certificateNumber: null,
      locationId: options.locationId ?? null,
      allocatedPurchaseCents: null,
    }],
  })
  return createdStockItems[0]!
}

describe('receiveStockItem', () => {
  it('moves an in-transit item to in-stock with the reception date', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId, { inTransit: true })

    const receivedStockItem = await receiveStockItem(database, ownerId, stockItem.id, '2026-11-05')

    expect(receivedStockItem).toMatchObject({ status: 'in-stock', receivedOn: '2026-11-05' })
  })

  it('answers 409 when received twice', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId, { inTransit: true })
    await receiveStockItem(database, ownerId, stockItem.id, '2026-11-05')

    await expect(receiveStockItem(database, ownerId, stockItem.id, '2026-11-06')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('answers 404 for the item of another user', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId, { inTransit: true })

    await expect(receiveStockItem(database, otherOwnerId, stockItem.id, '2026-11-05')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

describe('updateStockItem', () => {
  it('changes condition, location and notes', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const locationId = await insertLocation(database, ownerId, 'Cave')
    const stockItem = await buyOne(database, ownerId, productId)

    const updatedStockItem = await updateStockItem(database, ownerId, stockItem.id, {
      condition: 'sealed-damaged-box',
      locationId,
      notes: 'coin écrasé',
    })

    expect(updatedStockItem).toMatchObject({ condition: 'sealed-damaged-box', locationId, notes: 'coin écrasé' })
  })

  it('clears the location with null', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const locationId = await insertLocation(database, ownerId, 'Cave')
    const stockItem = await buyOne(database, ownerId, productId, { locationId })

    const updatedStockItem = await updateStockItem(database, ownerId, stockItem.id, { locationId: null })

    expect(updatedStockItem.locationId).toBeNull()
  })

  it('answers 422 for a condition not allowed by the product category', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId)

    await expect(updateStockItem(database, ownerId, stockItem.id, { condition: 'good' })).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('answers 404 for a location of another user', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const foreignLocationId = await insertLocation(database, otherOwnerId, 'Cave')
    const stockItem = await buyOne(database, ownerId, productId)

    await expect(
      updateStockItem(database, ownerId, stockItem.id, { locationId: foreignLocationId }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('answers 404 for the item of another user', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId)

    await expect(updateStockItem(database, otherOwnerId, stockItem.id, { notes: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('updates the grading fields of a graded card and refuses emptying them', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Dracaufeu', 'graded-card')
    const stockItem = await buyOne(database, ownerId, productId, { condition: 'graded' })

    const updatedStockItem = await updateStockItem(database, ownerId, stockItem.id, { grade: '9' })

    expect(updatedStockItem).toMatchObject({ gradingCompany: 'PSA', grade: '9' })
    await expect(updateStockItem(database, ownerId, stockItem.id, { grade: null })).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('stores the canonical grading company name on update', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Dracaufeu', 'graded-card')
    const stockItem = await buyOne(database, ownerId, productId, { condition: 'graded' })

    const updatedStockItem = await updateStockItem(database, ownerId, stockItem.id, { gradingCompany: 'cgc' })

    expect(updatedStockItem).toMatchObject({ gradingCompany: 'CGC' })
  })

  it('answers 422 when grading fields are set on a non-graded product', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId)

    await expect(updateStockItem(database, ownerId, stockItem.id, { grade: '10' })).rejects.toMatchObject({
      statusCode: 422,
    })
  })
})

describe('findStockItem', () => {
  it('returns the item joined with its product', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId)

    const foundStockItem = await findStockItem(database, ownerId, stockItem.id)

    expect(foundStockItem).toMatchObject({ id: stockItem.id, productName: 'Display', productCategory: 'pokemon-sealed' })
  })

  it('answers 404 for the item of another user', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const stockItem = await buyOne(database, ownerId, productId)

    await expect(findStockItem(database, otherOwnerId, stockItem.id)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('listStockItems', () => {
  it('lists the items of the owner only, with product name, image and category', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const productId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    await database.update(products).set({ imageUrl: 'https://example.com/display.png' }).where(eq(products.id, productId))
    await buyOne(database, ownerId, productId)
    await buyOne(database, otherOwnerId, productId)

    const listedStockItems = await listStockItems(database, ownerId, {})

    expect(listedStockItems).toHaveLength(1)
    expect(listedStockItems[0]).toMatchObject({
      ownerId,
      productName: 'Display',
      productImageUrl: 'https://example.com/display.png',
      productCategory: 'pokemon-sealed',
    })
  })

  it('filters by status, category and location', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const sealedProductId = await insertProduct(database, ownerId, 'Display', 'pokemon-sealed')
    const toyProductId = await insertProduct(database, ownerId, 'Peluche', 'toy')
    const locationId = await insertLocation(database, ownerId, 'Cave')
    await buyOne(database, ownerId, sealedProductId, { inTransit: true })
    await buyOne(database, ownerId, sealedProductId, { locationId })
    await buyOne(database, ownerId, toyProductId, { condition: 'good' })

    const inTransitNames = await listStockItems(database, ownerId, { status: ['in-transit'] })
    const toyNames = await listStockItems(database, ownerId, { category: 'toy' })
    const locatedNames = await listStockItems(database, ownerId, { locationId })
    const bothStatuses = await listStockItems(database, ownerId, { status: ['in-transit', 'in-stock'] })

    expect(inTransitNames.map(stockItem => stockItem.productName)).toEqual(['Display'])
    expect(toyNames.map(stockItem => stockItem.productName)).toEqual(['Peluche'])
    expect(locatedNames).toHaveLength(1)
    expect(bothStatuses).toHaveLength(3)
  })

  it('searches the product name without regard to case or accents', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const accentedProductId = await insertProduct(database, ownerId, 'Écarlate et Violet', 'pokemon-sealed')
    const otherProductId = await insertProduct(database, ownerId, 'Display Soleil', 'pokemon-sealed')
    await buyOne(database, ownerId, accentedProductId)
    await buyOne(database, ownerId, otherProductId)

    const matchedStockItems = await listStockItems(database, ownerId, { search: 'ecarlate' })

    expect(matchedStockItems.map(stockItem => stockItem.productName)).toEqual(['Écarlate et Violet'])
  })
})
