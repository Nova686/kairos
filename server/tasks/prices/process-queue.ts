import { processRefreshQueue } from '../../domain/prices/price-refresh-queue'
import { createPriceSourceGateway } from '../../domain/prices/refresh-product-prices'

export default defineTask({
  meta: {
    name: 'prices:process-queue',
    description: 'Refresh the prices of the next queued products',
  },
  async run() {
    return { result: await processRefreshQueue(await useDatabase(), createPriceSourceGateway(), new Date()) }
  },
})
