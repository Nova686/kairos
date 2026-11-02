import { and, asc, eq, ne } from 'drizzle-orm'
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

export class LocationLabelAlreadyUsedError extends Error {
  constructor() {
    super('Location label already used')
    this.name = 'LocationLabelAlreadyUsedError'
  }
}

export class LocationInUseError extends Error {
  constructor() {
    super('Location is used by at least one stock item')
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

const assertLabelAvailable = async (
  database: KairosDatabase,
  ownerId: string,
  label: string,
  excludedLocationId?: string,
): Promise<void> => {
  const sameLabelCondition = and(eq(locations.ownerId, ownerId), eq(locations.label, label))
  const [conflictingLocation] = await database
    .select({ id: locations.id })
    .from(locations)
    .where(excludedLocationId ? and(sameLabelCondition, ne(locations.id, excludedLocationId)) : sameLabelCondition)
  if (conflictingLocation) {
    throw new LocationLabelAlreadyUsedError()
  }
}

export const listLocations = (database: KairosDatabase, ownerId: string): Promise<Location[]> =>
  database.select().from(locations).where(eq(locations.ownerId, ownerId)).orderBy(asc(locations.label))

export const createLocation = async (database: KairosDatabase, ownerId: string, label: string): Promise<Location> => {
  const normalizedLabel = normalizeLabel(label)
  await assertLabelAvailable(database, ownerId, normalizedLabel)
  const [createdLocation] = await database.insert(locations).values({ ownerId, label: normalizedLabel }).returning()
  return createdLocation!
}

export const renameLocation = async (
  database: KairosDatabase,
  ownerId: string,
  locationId: string,
  label: string,
): Promise<Location> => {
  await findOwnedOr404(database, locations, locationId, ownerId)
  const normalizedLabel = normalizeLabel(label)
  await assertLabelAvailable(database, ownerId, normalizedLabel, locationId)
  const [renamedLocation] = await database
    .update(locations)
    .set({ label: normalizedLabel })
    .where(eq(locations.id, locationId))
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
  await database.delete(locations).where(eq(locations.id, locationId))
}
