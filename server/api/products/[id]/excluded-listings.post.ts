import { z } from 'zod'
import { excludeListing } from '../../../domain/prices/listing-exclusions'

const listingUrlBodySchema = z.object({ url: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { url } = await readBodyOr422(event, listingUrlBodySchema)
  await excludeListing(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', url, new Date())
  setResponseStatus(event, 204)
  return null
})
