import { listLocations } from '../../domain/locations/locations-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return listLocations(await useDatabase(), sessionUser.id)
})
