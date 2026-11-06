import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../../support/create-test-database.ts'
import { debts, locations, persons, products, purchases, stockItems, users } from '../../../server/database/schema/index.ts'

const expectedTableNames = [
  'users',
  'invitations',
  'products',
  'product_barcodes',
  'catalogue_changes',
  'cardmarket_products',
  'locations',
  'persons',
  'purchases',
  'stock_items',
  'sales',
  'sale_items',
  'debts',
]

const insertOwner = async (database: Awaited<ReturnType<typeof createTestDatabase>>) => {
  const [owner] = await database
    .insert(users)
    .values({ email: 'a@b.fr', displayName: 'A', passwordHash: 'x' })
    .returning()
  return owner!
}

describe('database schema', () => {
  it('creates every table', async () => {
    const database = await createTestDatabase()
    const tableRows = (await database.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    )) as { rows: { table_name: string }[] }
    const tableNames = tableRows.rows.map(row => row.table_name)
    expect(tableNames).toEqual(expect.arrayContaining(expectedTableNames))
  })

  it('rejects two locations with the same owner and label', async () => {
    const database = await createTestDatabase()
    const owner = await insertOwner(database)
    await database.insert(locations).values({ ownerId: owner.id, label: 'Étagère' })
    await expect(
      database.insert(locations).values({ ownerId: owner.id, label: 'Étagère' }),
    ).rejects.toThrow()
  })

  it('rejects deleting a product referenced by a stock item', async () => {
    const database = await createTestDatabase()
    const owner = await insertOwner(database)
    const [product] = await database
      .insert(products)
      .values({ name: 'ETB', category: 'pokemon-sealed', createdByUserId: owner.id })
      .returning()
    const [purchase] = await database
      .insert(purchases)
      .values({ ownerId: owner.id, purchasedOn: '2026-11-02', totalPriceCents: 5000 })
      .returning()
    await database.insert(stockItems).values({
      ownerId: owner.id,
      productId: product!.id,
      purchaseId: purchase!.id,
      condition: 'sealed-new',
      allocatedPurchaseCents: 5000,
      status: 'in-stock',
    })
    await expect(database.delete(products).where(sql`id = ${product!.id}`)).rejects.toThrow()
  })

  it('rejects a debt whose direction is neither owed to me nor I owe', async () => {
    const database = await createTestDatabase()
    const owner = await insertOwner(database)
    const [person] = await database.insert(persons).values({ ownerId: owner.id, name: 'Camille' }).returning()

    await expect(database.execute(sql`
      insert into debts (owner_id, person_id, amount_cents, direction, reason, created_on)
      values (${owner.id}, ${person!.id}, 100, 'sideways', 'Test', '2026-11-02')
    `)).rejects.toMatchObject({ cause: { code: '23514' } })
    expect(await database.select().from(debts)).toEqual([])
  })
})
