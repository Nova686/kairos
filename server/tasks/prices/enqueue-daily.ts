import { enqueueHeldProducts } from '../../domain/prices/price-refresh-queue'

export default defineTask({
  meta: {
    name: 'prices:enqueue-daily',
    description: 'Queue every held product not yet refreshed today',
  },
  async run() {
    return { result: { queuedProductCount: await enqueueHeldProducts(await useDatabase(), new Date()) } }
  },
})
