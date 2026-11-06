import { z } from 'zod'
import { productCategories } from '../../../shared/catalogue/product-category'
import { stockItemStatuses } from '../../../shared/stock/stock-item-status'
import { listStockItems } from '../../domain/stock/stock-items-service'

const stockItemFiltersSchema = z.object({
  status: z.preprocess(
    statusQuery => (typeof statusQuery === 'string' ? statusQuery.split(',') : statusQuery),
    z.array(z.enum(stockItemStatuses)).optional(),
  ),
  category: z.enum(productCategories).optional(),
  locationId: z.uuid().optional(),
  productId: z.uuid().optional(),
  search: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const parsedFilters = stockItemFiltersSchema.safeParse(getQuery(event))
  if (!parsedFilters.success) {
    throw createError({ statusCode: 422, statusMessage: 'Filtres invalides' })
  }
  return listStockItems(await useDatabase(), sessionUser.id, parsedFilters.data)
})
