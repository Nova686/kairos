import { z } from 'zod'
import { restoreListing } from '../../../domain/prices/listing-exclusions'

const listingUrlBodySchema = z.object({ url: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { url } = await readBodyOr422(event, listingUrlBodySchema)
  await restoreListing(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', url)
  setResponseStatus(event, 204)
  return null
})
