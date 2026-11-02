import { listDeliveries } from '../domain/deliveries/list-deliveries'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return listDeliveries(await useDatabase(), sessionUser.id)
})
