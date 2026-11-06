import { locationBodySchema } from '../../domain/locations/location-body-schema'
import { renameLocation } from '../../domain/locations/locations-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { label } = await readBodyOr422(event, locationBodySchema)
  return renameLocation(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', label)
})
