import { z } from 'zod'
import { createPerson } from '../../domain/persons/persons-service'

const personBodySchema = z.object({ name: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { name } = await readBodyOr422(event, personBodySchema)
  return createPerson(await useDatabase(), sessionUser.id, name)
})
