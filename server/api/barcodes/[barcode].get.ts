import { findProductByBarcode } from '../../domain/catalogue/catalogue-service'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  const product = await findProductByBarcode(await useDatabase(), getRouterParam(event, 'barcode') ?? '')
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
  return product
})
