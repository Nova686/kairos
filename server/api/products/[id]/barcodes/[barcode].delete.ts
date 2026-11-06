import { detachBarcode } from '../../../../domain/catalogue/catalogue-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  await detachBarcode(
    await useDatabase(),
    sessionUser.id,
    getRouterParam(event, 'id') ?? '',
    getRouterParam(event, 'barcode') ?? '',
  )
  setResponseStatus(event, 204)
  return null
})
