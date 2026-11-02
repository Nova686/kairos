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
  keywords: string[]
  kairosCondition: ConditionCode
  priority: number
}

export interface ConditionResolutionInput {
  category: string
  source: string
  sourceCondition: string | null
  title: string
}

export const maximumTitleLengthTested = 120

export interface CompiledTitleRule {
  category: string
  keywordWordSequences: string[][]
  kairosCondition: ConditionCode
  priority: number
}

export interface CompiledTitleRules {
  rules: CompiledTitleRule[]
}

const foldForMatching = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const splitIntoWords = (text: string): string[] =>
  foldForMatching(text).split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 0)

export const compileTitleRules = (rules: TitleConditionRuleEntry[]): CompiledTitleRules => ({
  rules: rules
    .map(rule => ({
      category: rule.category,
      keywordWordSequences: rule.keywords.map(splitIntoWords).filter(sequence => sequence.length > 0),
      kairosCondition: rule.kairosCondition,
      priority: rule.priority,
    }))
    .sort((first, second) => second.priority - first.priority),
})

const sequenceStartsAt = (titleWords: string[], sequence: string[], startIndex: number): boolean =>
  sequence.every((keywordWord, offset) => titleWords[startIndex + offset]?.startsWith(keywordWord) === true)

const titleMatchesSequence = (titleWords: string[], sequence: string[]): boolean => {
  for (let startIndex = 0; startIndex + sequence.length <= titleWords.length; startIndex++) {
    if (sequenceStartsAt(titleWords, sequence, startIndex)) return true
  }
  return false
}

export const resolveKairosConditionWithCompiledRules = (
  mappings: ConditionMappingEntry[],
  compiledRules: CompiledTitleRules,
  input: ConditionResolutionInput,
): ConditionCode | null => {
  const titleWords = splitIntoWords(input.title.slice(0, maximumTitleLengthTested))
  const matchingRule = compiledRules.rules.find(rule =>
    rule.category === input.category
    && rule.keywordWordSequences.some(sequence => titleMatchesSequence(titleWords, sequence)))
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
