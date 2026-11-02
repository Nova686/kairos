import { updateProduct } from '../../domain/catalogue/catalogue-service'
import type { ProductDraft } from '../../../shared/catalogue/product-draft'
import { productChangesSchema } from '../../../shared/catalogue/product-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const productChanges = await readBodyOr422(event, productChangesSchema)
  return updateProduct(
    await useDatabase(),
    sessionUser.id,
    getRouterParam(event, 'id') ?? '',
    productChanges as Partial<ProductDraft>,
  )
})
