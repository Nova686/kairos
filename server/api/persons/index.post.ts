import { personBodySchema } from '../../domain/persons/person-body-schema'
import { createPerson } from '../../domain/persons/persons-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { name } = await readBodyOr422(event, personBodySchema)
  return createPerson(await useDatabase(), sessionUser.id, name)
})
