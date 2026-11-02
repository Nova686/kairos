import { deleteDebt } from '../../domain/debts/debts-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await deleteDebt(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
  setResponseStatus(event, 204)
  return null
})
