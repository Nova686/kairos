import { createPurchase } from '../../domain/stock/purchases-service'
import { purchaseDraftSchema } from '../../../shared/stock/purchase-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const purchaseDraft = await readBodyOr422(event, purchaseDraftSchema)
  return createPurchase(await useDatabase(), sessionUser.id, purchaseDraft)
})
