import { markSaleDelivered } from '../../../domain/sales/sales-service'
import { markSaleDeliveredSchema } from '../../../../shared/sales/sale-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { deliveredOn } = await readBodyOr422(event, markSaleDeliveredSchema)
  return markSaleDelivered(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', deliveredOn)
})
