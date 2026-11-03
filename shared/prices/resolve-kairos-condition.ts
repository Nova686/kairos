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

export const keywordPrefixMarker = '*'

export const negationWords = ['non', 'jamais', 'pas', 'never', 'not']

export interface CompiledKeyword {
  words: string[]
  isPrefix: boolean
}

export interface CompiledTitleRule {
  category: string
  compiledKeywords: CompiledKeyword[]
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

const foldedNegationWords = new Set(negationWords.map(foldForMatching))

const compileKeyword = (keyword: string): CompiledKeyword => {
  const trimmedKeyword = keyword.trim()
  return { words: splitIntoWords(trimmedKeyword), isPrefix: trimmedKeyword.endsWith(keywordPrefixMarker) }
}

export const compileTitleRules = (rules: TitleConditionRuleEntry[]): CompiledTitleRules => ({
  rules: rules
    .map(rule => ({
      category: rule.category,
      compiledKeywords: rule.keywords.map(compileKeyword).filter(compiledKeyword => compiledKeyword.words.length > 0),
      kairosCondition: rule.kairosCondition,
      priority: rule.priority,
    }))
    .sort((first, second) => second.priority - first.priority),
})

const wordMatches = (titleWord: string | undefined, keywordWord: string, isPrefix: boolean): boolean =>
  titleWord !== undefined && (isPrefix ? titleWord.startsWith(keywordWord) : titleWord === keywordWord)

const keywordStartsAt = (titleWords: string[], compiledKeyword: CompiledKeyword, startIndex: number): boolean =>
  compiledKeyword.words.every((keywordWord, offset) => wordMatches(
    titleWords[startIndex + offset],
    keywordWord,
    compiledKeyword.isPrefix && offset === compiledKeyword.words.length - 1,
  ))

const isNegatedAt = (titleWords: string[], startIndex: number): boolean =>
  startIndex > 0 && foldedNegationWords.has(titleWords[startIndex - 1]!)

const titleMatchesKeyword = (titleWords: string[], compiledKeyword: CompiledKeyword): boolean => {
  for (let startIndex = 0; startIndex + compiledKeyword.words.length <= titleWords.length; startIndex++) {
    if (keywordStartsAt(titleWords, compiledKeyword, startIndex) && !isNegatedAt(titleWords, startIndex)) return true
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
    && rule.compiledKeywords.some(compiledKeyword => titleMatchesKeyword(titleWords, compiledKeyword)))
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
