import { findProductByBarcode } from '../../domain/catalogue/catalogue-service'
import { normalizeBarcode } from '../../../shared/scan/normalize-barcode'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  const normalizedBarcode = normalizeBarcode(getRouterParam(event, 'barcode') ?? '')
  if (normalizedBarcode === null) {
    throw createError({ statusCode: 422, statusMessage: 'Code-barres invalide' })
  }
  const product = await findProductByBarcode(await useDatabase(), normalizedBarcode)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
  return product
})
