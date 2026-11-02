import { LocationInUseError, deleteLocation } from '../../domain/locations/locations-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await deleteLocation(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
    .catch((failure: unknown) => rethrowAsConflict(failure, [LocationInUseError]))
  setResponseStatus(event, 204)
  return null
})
