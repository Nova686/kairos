import { createSale } from '../../domain/sales/sales-service'
import { saleDraftSchema } from '../../../shared/sales/sale-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const saleDraft = await readBodyOr422(event, saleDraftSchema)
  return createSale(await useDatabase(), sessionUser.id, saleDraft)
})
