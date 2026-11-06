import { findProductOr404 } from '../../../domain/catalogue/catalogue-service'
import { listProductChanges } from '../../../domain/catalogue/catalogue-journal'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  const database = await useDatabase()
  const product = await findProductOr404(database, getRouterParam(event, 'id') ?? '')
  return listProductChanges(database, product.id)
})
