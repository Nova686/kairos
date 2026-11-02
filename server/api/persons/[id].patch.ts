import { z } from 'zod'
import { renamePerson } from '../../domain/persons/persons-service'

const personBodySchema = z.object({ name: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { name } = await readBodyOr422(event, personBodySchema)
  return renamePerson(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', name)
})
