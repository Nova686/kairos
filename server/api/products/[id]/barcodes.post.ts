import { z } from 'zod'
import { attachBarcode } from '../../../domain/catalogue/catalogue-service'

const barcodeBodySchema = z.object({ barcode: z.string().trim().min(1) })

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { barcode } = await readBodyOr422(event, barcodeBodySchema)
  await attachBarcode(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', barcode)
  setResponseStatus(event, 204)
  return null
})
