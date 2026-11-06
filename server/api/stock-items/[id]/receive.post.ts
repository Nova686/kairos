import { receiveStockItem } from '../../../domain/stock/stock-items-service'
import { receiveStockItemSchema } from '../../../../shared/stock/purchase-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { receivedOn } = await readBodyOr422(event, receiveStockItemSchema)
  return receiveStockItem(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', receivedOn)
})
