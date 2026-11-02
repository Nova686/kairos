import { listPurchases } from '../../domain/stock/purchases-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return listPurchases(await useDatabase(), sessionUser.id)
})
