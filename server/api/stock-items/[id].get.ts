import { findStockItem } from '../../domain/stock/stock-items-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return findStockItem(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
})
