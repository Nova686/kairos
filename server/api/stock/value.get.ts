import { valueStock } from '../../domain/valuation/value-stock'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return valueStock(await useDatabase(), sessionUser.id, new Date())
})
