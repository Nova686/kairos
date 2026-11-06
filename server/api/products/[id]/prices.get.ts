import { productPriceOverview } from '../../../domain/prices/product-price-overview'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return productPriceOverview(await useDatabase(), getRouterParam(event, 'id') ?? '', new Date())
})
