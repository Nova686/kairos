import { PersonInUseError, deletePerson } from '../../domain/persons/persons-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await deletePerson(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
    .catch((failure: unknown) => rethrowAsConflict(failure, [PersonInUseError]))
  setResponseStatus(event, 204)
  return null
})
