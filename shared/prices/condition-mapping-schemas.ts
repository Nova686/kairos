import { z } from 'zod'
import { conditionCodes, isConditionAllowed } from '../catalogue/condition-scale.ts'
import { isProductCategory, productCategories } from '../catalogue/product-category.ts'
import { isValidTitleRulePattern } from './resolve-kairos-condition.ts'

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

const titleRuleFieldsSchema = z.object({
  category: categorySchema,
  pattern: nonEmptyText.refine(isValidTitleRulePattern, { message: 'Expression régulière invalide' }),
  kairosCondition: conditionSchema,
  priority: z.number().int().min(0).max(1000),
})

export const titleRuleDraftSchema = titleRuleFieldsSchema
  .refine(conditionBelongsToCategory, { message: 'Condition hors de l\'échelle de la catégorie', path: ['kairosCondition'] })

export const titleRuleChangesSchema = titleRuleFieldsSchema.partial()
