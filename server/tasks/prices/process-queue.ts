import { takeNextRefreshBatch } from '../../domain/prices/price-refresh-queue'
import { createPriceSourceGateway, loadRefreshRulesContext, refreshProductPrices } from '../../domain/prices/refresh-product-prices'

export default defineTask({
  meta: {
    name: 'prices:process-queue',
    description: 'Refresh the prices of the next queued products',
  },
  async run() {
    const database = await useDatabase()
    const productIds = await takeNextRefreshBatch(database)
    if (productIds.length === 0) {
      return { result: { refreshedProductCount: 0, failedProductCount: 0 } }
    }
    const gateway = createPriceSourceGateway()
    const rulesContext = await loadRefreshRulesContext(database)
    let refreshedProductCount = 0
    let failedProductCount = 0
    for (const productId of productIds) {
      try {
        await refreshProductPrices(database, gateway, productId, new Date(), rulesContext)
        refreshedProductCount += 1
      }
      catch {
        failedProductCount += 1
      }
    }
    return { result: { refreshedProductCount, failedProductCount } }
  },
})
