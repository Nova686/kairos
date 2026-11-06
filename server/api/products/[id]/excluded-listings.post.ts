import { listingUrlBodySchema } from '../../../domain/prices/listing-url-body-schema'
import { excludeListing } from '../../../domain/prices/listing-exclusions'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { url } = await readBodyOr422(event, listingUrlBodySchema)
  await excludeListing(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', url, new Date())
  setResponseStatus(event, 204)
  return null
})
