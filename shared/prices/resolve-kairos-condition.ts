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

export const maximumTitleRulePatternLength = 200

export const isValidTitleRulePattern = (pattern: string): boolean => {
  if (pattern.length > maximumTitleRulePatternLength) {
    return false
  }
  try {
    new RegExp(pattern, 'i')
    return true
  }
  catch {
    return false
  }
}

export interface CompiledTitleRule {
  category: string
  matcher: RegExp
  kairosCondition: ConditionCode
  priority: number
}

export interface CompiledTitleRules {
  rules: CompiledTitleRule[]
  skippedPatterns: string[]
}

export const compileTitleRules = (rules: TitleConditionRuleEntry[]): CompiledTitleRules => {
  const compiled: CompiledTitleRule[] = []
  const skippedPatterns: string[] = []
  for (const rule of rules) {
    if (!isValidTitleRulePattern(rule.pattern)) {
      skippedPatterns.push(rule.pattern)
      continue
    }
    compiled.push({
      category: rule.category,
      matcher: new RegExp(rule.pattern, 'i'),
      kairosCondition: rule.kairosCondition,
      priority: rule.priority,
    })
  }
  compiled.sort((first, second) => second.priority - first.priority)
  return { rules: compiled, skippedPatterns }
}

export const resolveKairosConditionWithCompiledRules = (
  mappings: ConditionMappingEntry[],
  compiledRules: CompiledTitleRules,
  input: ConditionResolutionInput,
): ConditionCode | null => {
  const matchingRule = compiledRules.rules.find(rule =>
    rule.category === input.category && rule.matcher.test(input.title))
  if (matchingRule) {
    return matchingRule.kairosCondition
  }
  const matchingMapping = mappings.find(mapping =>
    mapping.category === input.category
    && mapping.source === input.source
    && mapping.sourceCondition === input.sourceCondition)
  return matchingMapping?.kairosCondition ?? null
}

export const resolveKairosCondition = (
  mappings: ConditionMappingEntry[],
  rules: TitleConditionRuleEntry[],
  input: ConditionResolutionInput,
): ConditionCode | null =>
  resolveKairosConditionWithCompiledRules(mappings, compileTitleRules(rules), input)
