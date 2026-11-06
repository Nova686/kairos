import { listPersons } from '../../domain/persons/persons-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return listPersons(await useDatabase(), sessionUser.id)
})
