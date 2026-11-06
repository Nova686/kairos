import { locationBodySchema } from '../../domain/locations/location-body-schema'
import { createLocation } from '../../domain/locations/locations-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { label } = await readBodyOr422(event, locationBodySchema)
  return createLocation(await useDatabase(), sessionUser.id, label)
})
