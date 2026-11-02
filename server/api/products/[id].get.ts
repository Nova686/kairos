import { findProductOr404 } from '../../domain/catalogue/catalogue-service'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return findProductOr404(await useDatabase(), getRouterParam(event, 'id') ?? '')
})
