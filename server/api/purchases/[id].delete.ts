import { deletePurchase } from '../../domain/stock/purchases-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await deletePurchase(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
  setResponseStatus(event, 204)
  return null
})
