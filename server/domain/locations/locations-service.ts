import { and, asc, eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { locations, stockItems } from '../../database/schema/index.ts'
import { findOwnedOr404 } from '../ownership/find-owned-or-404.ts'

export type Location = typeof locations.$inferSelect

export class LocationLabelInvalidError extends Error {
  constructor() {
    super('Location label must not be empty')
    this.name = 'LocationLabelInvalidError'
  }
}

export class LocationInUseError extends Error {
  constructor() {
    super('Cet emplacement contient encore des exemplaires')
    this.name = 'LocationInUseError'
  }
}

const normalizeLabel = (label: string): string => {
  const trimmedLabel = label.trim()
  if (trimmedLabel === '') {
    throw new LocationLabelInvalidError()
  }
  return trimmedLabel
}

export const listLocations = (database: KairosDatabase, ownerId: string): Promise<Location[]> =>
  database.select().from(locations).where(eq(locations.ownerId, ownerId)).orderBy(asc(locations.label))

export const createLocation = async (database: KairosDatabase, ownerId: string, label: string): Promise<Location> => {
  const [createdLocation] = await database.insert(locations).values({ ownerId, label: normalizeLabel(label) }).returning()
  return createdLocation!
}

export const renameLocation = async (
  database: KairosDatabase,
  ownerId: string,
  locationId: string,
  label: string,
): Promise<Location> => {
  await findOwnedOr404(database, locations, locationId, ownerId)
  const [renamedLocation] = await database
    .update(locations)
    .set({ label: normalizeLabel(label) })
    .where(and(eq(locations.id, locationId), eq(locations.ownerId, ownerId)))
    .returning()
  return renamedLocation!
}

export const deleteLocation = async (database: KairosDatabase, ownerId: string, locationId: string): Promise<void> => {
  await findOwnedOr404(database, locations, locationId, ownerId)
  const [usingStockItem] = await database
    .select({ id: stockItems.id })
    .from(stockItems)
    .where(eq(stockItems.locationId, locationId))
    .limit(1)
  if (usingStockItem) {
    throw new LocationInUseError()
  }
  await database.delete(locations).where(and(eq(locations.id, locationId), eq(locations.ownerId, ownerId)))
}
