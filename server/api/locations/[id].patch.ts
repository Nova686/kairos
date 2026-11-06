import { z } from 'zod'
import { renameLocation } from '../../domain/locations/locations-service'

const locationBodySchema = z.object({ label: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { label } = await readBodyOr422(event, locationBodySchema)
  return renameLocation(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', label)
})
