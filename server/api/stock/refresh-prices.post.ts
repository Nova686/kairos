import { enqueueUserHeldProducts } from '../../domain/prices/price-refresh-queue'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return { queuedProductCount: await enqueueUserHeldProducts(await useDatabase(), sessionUser.id, new Date()) }
})
