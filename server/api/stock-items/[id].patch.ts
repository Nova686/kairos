import { updateStockItem, type StockItemChanges } from '../../domain/stock/stock-items-service'
import { stockItemChangesSchema } from '../../../shared/stock/purchase-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const stockItemChanges = await readBodyOr422(event, stockItemChangesSchema)
  return updateStockItem(
    await useDatabase(),
    sessionUser.id,
    getRouterParam(event, 'id') ?? '',
    stockItemChanges as StockItemChanges,
  )
})
