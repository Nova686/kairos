import { manualPriceDraftSchema } from '../../../../shared/prices/manual-price-draft-schema'
import { recordManualPrice } from '../../../domain/prices/manual-price-entries'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const draft = await readBodyOr422(event, manualPriceDraftSchema)
  const snapshotId = await recordManualPrice(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', draft)
  setResponseStatus(event, 201)
  return { snapshotId }
})
