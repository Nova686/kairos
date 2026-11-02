import { listStockValueHistory } from '../../domain/valuation/stock-value-history'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return listStockValueHistory(await useDatabase(), sessionUser.id, new Date())
})
