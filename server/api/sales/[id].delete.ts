import { deleteSale } from '../../domain/sales/sales-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await deleteSale(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
  setResponseStatus(event, 204)
  return null
})
