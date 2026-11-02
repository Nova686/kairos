import type { ConditionCode } from '../catalogue/condition-scale.ts'

export interface ConditionMappingEntry {
  category: string
  source: string
  sourceCondition: string
  kairosCondition: ConditionCode
}

export interface TitleConditionRuleEntry {
  id: string
  category: string
  pattern: string
  kairosCondition: ConditionCode
  priority: number
}

export interface ConditionResolutionInput {
  category: string
  source: string
  sourceCondition: string | null
  title: string
}

export const isValidTitleRulePattern = (pattern: string): boolean => {
  try {
    new RegExp(pattern, 'i')
    return true
  }
  catch {
    return false
  }
}

const titleMatchesRule = (title: string, rule: TitleConditionRuleEntry): boolean =>
  isValidTitleRulePattern(rule.pattern) && new RegExp(rule.pattern, 'i').test(title)

export const resolveKairosCondition = (
  mappings: ConditionMappingEntry[],
  rules: TitleConditionRuleEntry[],
  input: ConditionResolutionInput,
): ConditionCode | null => {
  const matchingRule = rules
    .filter(rule => rule.category === input.category && titleMatchesRule(input.title, rule))
    .sort((first, second) => second.priority - first.priority)[0]
  if (matchingRule) {
    return matchingRule.kairosCondition
  }
  const matchingMapping = mappings.find(mapping =>
    mapping.category === input.category
    && mapping.source === input.source
    && mapping.sourceCondition === input.sourceCondition)
  return matchingMapping?.kairosCondition ?? null
}
