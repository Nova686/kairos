import { z } from 'zod'
import { productCategories } from './product-category.ts'

const optionalText = z.string().trim().min(1).nullable()

export const productDraftSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(productCategories),
  productType: optionalText.default(null),
  seriesName: optionalText.default(null),
  language: optionalText.default(null),
  imageUrl: optionalText.default(null),
  cardmarketProductId: z.number().int().positive().nullable().default(null),
  tcgdexCardId: optionalText.default(null),
  pokemontcgCardId: optionalText.default(null),
  ebayQuery: optionalText.default(null),
  ebayExcludedKeywords: z.array(z.string().trim().min(1)).default([]),
})

export const productChangesSchema = productDraftSchema.partial().strict()
