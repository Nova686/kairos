import { conditionCodes, conditionCodesFor, conditionLabel, type ConditionCode } from '../../shared/catalogue/condition-scale.ts'
import type { ProductCategory } from '../../shared/catalogue/product-category.ts'

export const conditionKeptInCategory = (category: ProductCategory, condition: ConditionCode): ConditionCode => {
  const allowedConditions = conditionCodesFor(category)
  return allowedConditions.includes(condition) ? condition : allowedConditions[0]!
}

const isConditionCode = (candidate: string): candidate is ConditionCode =>
  (conditionCodes as string[]).includes(candidate)

export const describeConditionUsed = (usedCondition: string): string =>
  isConditionCode(usedCondition) ? conditionLabel(usedCondition) : usedCondition
