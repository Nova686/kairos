import { z } from 'zod'
import { attachBarcode } from '../../../domain/catalogue/catalogue-service'
import { normalizeBarcode } from '../../../../shared/scan/normalize-barcode'

const barcodeBodySchema = z.object({
  barcode: z.string().transform(rawBarcode => normalizeBarcode(rawBarcode)).pipe(z.string()),
})

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { barcode } = await readBodyOr422(event, barcodeBodySchema)
  await attachBarcode(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', barcode)
  setResponseStatus(event, 204)
  return null
})
