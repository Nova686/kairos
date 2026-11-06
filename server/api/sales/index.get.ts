import { listSales } from '../../domain/sales/sales-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return listSales(await useDatabase(), sessionUser.id)
})
