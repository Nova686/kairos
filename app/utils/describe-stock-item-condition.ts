import { conditionLabel, type ConditionCode } from '../../shared/catalogue/condition-scale.ts'

export const describeStockItemCondition = (
  condition: string,
  gradingCompany: string | null,
  grade: string | null,
): string => {
  if (gradingCompany !== null && grade !== null) {
    return `${gradingCompany} ${grade}`
  }
  return conditionLabel(condition as ConditionCode)
}
