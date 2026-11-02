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

export const maximumTitleLengthTested = 120

const lookaroundPrefixes = ['(?=', '(?!', '(?<=', '(?<!']
const boundedRepetitionPattern = /^\{\d+(,\d*)?\}/

const repetitionLengthAt = (pattern: string, position: number): number => {
  const character = pattern[position]
  if (character === '+' || character === '*' || character === '?') return 1
  if (character === '{') return boundedRepetitionPattern.exec(pattern.slice(position))?.[0].length ?? 0
  return 0
}

const isUnboundedRepetitionAt = (pattern: string, position: number): boolean => {
  const character = pattern[position]
  return character === '+' || character === '*' || (character === '{' && repetitionLengthAt(pattern, position) > 0)
}

const hasUnsafeStructure = (pattern: string): boolean => {
  const groupStack: { holdsRepetitionOrAlternation: boolean }[] = []
  const markCurrentLevel = (): void => {
    const currentGroup = groupStack[groupStack.length - 1]
    if (currentGroup) currentGroup.holdsRepetitionOrAlternation = true
  }
  let position = 0
  while (position < pattern.length) {
    const character = pattern[position]!
    if (character === '\\') {
      const escaped = pattern[position + 1]
      if (escaped === 'k' || (escaped !== undefined && escaped >= '1' && escaped <= '9')) return true
      position += 2
    }
    else if (character === '[') {
      position += 1
      while (position < pattern.length && pattern[position] !== ']') {
        position += pattern[position] === '\\' ? 2 : 1
      }
      position += 1
    }
    else if (character === '(') {
      if (lookaroundPrefixes.some(prefix => pattern.startsWith(prefix, position))) return true
      groupStack.push({ holdsRepetitionOrAlternation: false })
      if (pattern.startsWith('(?:', position)) position += 3
      else if (pattern.startsWith('(?<', position)) position = pattern.indexOf('>', position) + 1 || pattern.length
      else position += 1
    }
    else if (character === ')') {
      const closedGroup = groupStack.pop()
      if (!closedGroup) return true
      if (closedGroup.holdsRepetitionOrAlternation && isUnboundedRepetitionAt(pattern, position + 1)) return true
      if (closedGroup.holdsRepetitionOrAlternation || repetitionLengthAt(pattern, position + 1) > 0) markCurrentLevel()
      position += 1
    }
    else {
      if (character === '|' || repetitionLengthAt(pattern, position) > 0) markCurrentLevel()
      position += 1
    }
  }
  return groupStack.length > 0
}

export const isValidTitleRulePattern = (pattern: string): boolean => {
  if (pattern.length > maximumTitleRulePatternLength) {
    return false
  }
  try {
    if (hasUnsafeStructure(pattern)) {
      return false
    }
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
  const testedTitle = input.title.slice(0, maximumTitleLengthTested)
  const matchingRule = compiledRules.rules.find(rule =>
    rule.category === input.category && rule.matcher.test(testedTitle))
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
