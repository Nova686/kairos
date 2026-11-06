import { z } from 'zod'
import { conditionCodes, isConditionAllowed } from '../catalogue/condition-scale.ts'
import { isProductCategory, productCategories } from '../catalogue/product-category.ts'
import { keywordPrefixMarker } from './resolve-kairos-condition.ts'

const categorySchema = z.enum(productCategories)
const conditionSchema = z.enum(conditionCodes)
const nonEmptyText = z.string().trim().min(1)

const conditionBelongsToCategory = (entry: { category: string, kairosCondition: (typeof conditionCodes)[number] }): boolean =>
  isProductCategory(entry.category) && isConditionAllowed(entry.category, entry.kairosCondition)

export const conditionMappingKeySchema = z.object({
  category: categorySchema,
  source: nonEmptyText,
  sourceCondition: nonEmptyText,
})

export const conditionMappingDraftSchema = conditionMappingKeySchema
  .extend({ kairosCondition: conditionSchema })
  .refine(conditionBelongsToCategory, { message: 'Condition hors de l\'échelle de la catégorie', path: ['kairosCondition'] })

const keywordStem = (keyword: string): string =>
  keyword.endsWith(keywordPrefixMarker) ? keyword.slice(0, -keywordPrefixMarker.length).trim() : keyword

const hasValidPrefixMarker = (keyword: string): boolean => {
  const stem = keywordStem(keyword)
  return !stem.includes(keywordPrefixMarker) && stem.length >= 2
}

const letterOrDigitPattern = /[\p{L}\p{N}]/u

const keywordSchema = z.string().trim().min(2).max(40)
  .refine(hasValidPrefixMarker, { message: 'Une étoile n\'est permise qu\'à la fin, après au moins deux caractères' })
  .refine(keyword => letterOrDigitPattern.test(keyword), { message: 'Un mot-clé contient au moins une lettre ou un chiffre' })

const titleRuleFieldsSchema = z.object({
  category: categorySchema,
  keywords: z.array(keywordSchema).min(1).max(20),
  kairosCondition: conditionSchema,
  priority: z.number().int().min(0).max(1000),
})

export const titleRuleDraftSchema = titleRuleFieldsSchema
  .refine(conditionBelongsToCategory, { message: 'Condition hors de l\'échelle de la catégorie', path: ['kairosCondition'] })

const partialConditionBelongsToCategory = (changes: { category?: string, kairosCondition?: (typeof conditionCodes)[number] }): boolean =>
  changes.category === undefined || changes.kairosCondition === undefined
  || conditionBelongsToCategory({ category: changes.category, kairosCondition: changes.kairosCondition })

export const titleRuleChangesSchema = titleRuleFieldsSchema
  .partial()
  .refine(partialConditionBelongsToCategory, { message: 'Condition hors de l\'échelle de la catégorie', path: ['kairosCondition'] })
