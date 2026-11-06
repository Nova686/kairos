import { identifyBarcode } from '../../../domain/scan/identify-barcode'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return identifyBarcode(await useDatabase(), getRouterParam(event, 'barcode') ?? '')
})
