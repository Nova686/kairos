import { revertCatalogueChange } from '../../../domain/catalogue/catalogue-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return revertCatalogueChange(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '')
})
