import { products, purchases, stockItems, users } from '../../../server/database/schema/index.ts'
import {
  LocationInUseError,
  LocationLabelInvalidError,
  createLocation,
  deleteLocation,
  listLocations,
  renameLocation,
} from '../../../server/domain/locations/locations-service.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { describeDatabaseConflict } from '../../../server/database/database-conflict.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const expectDuplicateLabelConflict = async (action: Promise<unknown>): Promise<void> => {
  const failure = await action.then(() => null, (rejection: unknown) => rejection)
  expect(describeDatabaseConflict(failure)).toBe('Un emplacement porte déjà ce nom')
}

const insertStockItemAt = async (database: KairosDatabase, ownerId: string, locationId: string): Promise<void> => {
  const [product] = await database
    .insert(products)
    .values({ name: 'Display', category: 'pokemon-sealed', createdByUserId: ownerId })
    .returning()
  const [purchase] = await database
    .insert(purchases)
    .values({ ownerId, purchasedOn: '2026-11-02', totalPriceCents: 1000 })
    .returning()
  await database.insert(stockItems).values({
    ownerId,
    productId: product!.id,
    purchaseId: purchase!.id,
    condition: 'sealed-new',
    allocatedPurchaseCents: 1000,
    locationId,
    status: 'in-stock',
  })
}

describe('locations service', () => {
  it('creates a location with a trimmed label and lists it for its owner only', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')

    await createLocation(database, ownerId, '  Étagère 1  ')

    expect((await listLocations(database, ownerId)).map(location => location.label)).toEqual(['Étagère 1'])
    expect(await listLocations(database, otherOwnerId)).toEqual([])
  })

  it('rejects an empty label', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')

    await expect(createLocation(database, ownerId, '   ')).rejects.toBeInstanceOf(LocationLabelInvalidError)
  })

  it('rejects a duplicate label for the same owner but accepts it for another owner', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    await createLocation(database, ownerId, 'Cave')

    await expectDuplicateLabelConflict(createLocation(database, ownerId, ' Cave '))
    await expect(createLocation(database, otherOwnerId, 'Cave')).resolves.toMatchObject({ label: 'Cave' })
  })

  it('renames a location and rejects a rename onto another label already used', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const cave = await createLocation(database, ownerId, 'Cave')
    await createLocation(database, ownerId, 'Grenier')

    const renamedLocation = await renameLocation(database, ownerId, cave.id, 'Cave 2')

    expect(renamedLocation.label).toBe('Cave 2')
    await expectDuplicateLabelConflict(renameLocation(database, ownerId, cave.id, 'Grenier'))
    await expect(renameLocation(database, ownerId, cave.id, 'Cave 2')).resolves.toMatchObject({ label: 'Cave 2' })
  })

  it('answers 404 when renaming or deleting a location of another owner', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherOwnerId = await insertOwner(database, 'b@example.com')
    const cave = await createLocation(database, ownerId, 'Cave')

    await expect(renameLocation(database, otherOwnerId, cave.id, 'Volée')).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteLocation(database, otherOwnerId, cave.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('refuses to delete a location used by a stock item', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const cave = await createLocation(database, ownerId, 'Cave')
    await insertStockItemAt(database, ownerId, cave.id)

    await expect(deleteLocation(database, ownerId, cave.id)).rejects.toBeInstanceOf(LocationInUseError)
    expect(await listLocations(database, ownerId)).toHaveLength(1)
  })

  it('deletes an unused location', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const cave = await createLocation(database, ownerId, 'Cave')

    await deleteLocation(database, ownerId, cave.id)

    expect(await listLocations(database, ownerId)).toEqual([])
  })
})
