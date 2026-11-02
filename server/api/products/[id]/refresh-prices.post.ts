import { refreshProductNow } from '../../../domain/prices/price-refresh-queue'
import { createPriceSourceGateway } from '../../../domain/prices/refresh-product-prices'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return refreshProductNow(
    await useDatabase(),
    createPriceSourceGateway(),
    getRouterParam(event, 'id') ?? '',
    sessionUser.id,
    new Date(),
  )
})
