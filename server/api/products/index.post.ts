import { createProduct } from '../../domain/catalogue/catalogue-service'
import type { ProductDraft } from '../../../shared/catalogue/product-draft'
import { productDraftSchema } from '../../../shared/catalogue/product-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const productDraft = await readBodyOr422(event, productDraftSchema)
  return createProduct(await useDatabase(), sessionUser.id, productDraft as ProductDraft)
})
