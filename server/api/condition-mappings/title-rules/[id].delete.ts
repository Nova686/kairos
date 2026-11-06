import { deleteTitleRule } from '../../../domain/prices/condition-mappings-store'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await deleteTitleRule(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
  setResponseStatus(event, 204)
  return null
})
