import { z } from 'zod'
import { linkBarcode } from '../../../../domain/scan/identify-barcode'

const barcodeLinkSchema = z.object({ productId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const { productId } = await readBodyOr422(event, barcodeLinkSchema)
  await linkBarcode(await useDatabase(), user.id, productId, getRouterParam(event, 'barcode') ?? '')
  return { linked: true }
})
