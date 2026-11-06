import { refreshProductNow } from '../../../domain/prices/price-refresh-queue'
import { createPriceSourceGateway } from '../../../domain/prices/refresh-product-prices'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  try {
    return await refreshProductNow(
      await useDatabase(),
      createPriceSourceGateway(),
      getRouterParam(event, 'id') ?? '',
      sessionUser.id,
      new Date(),
    )
  }
  catch (error) {
    const retryAfterSeconds = (error as { data?: { retryAfterSeconds?: number } }).data?.retryAfterSeconds
    if (retryAfterSeconds !== undefined) {
      setResponseHeader(event, 'Retry-After', retryAfterSeconds)
    }
    throw error
  }
})
