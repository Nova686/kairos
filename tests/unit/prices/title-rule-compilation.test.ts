import { describe, expect, it } from 'vitest'
import { titleRuleDraftSchema } from '../../../shared/prices/condition-mapping-schemas.ts'
import {
  compileTitleRules,
  isValidTitleRulePattern,
  resolveKairosConditionWithCompiledRules,
} from '../../../shared/prices/resolve-kairos-condition.ts'

const rule = (pattern: string, priority = 1) => ({
  id: pattern, category: 'pokemon-sealed', pattern, kairosCondition: 'opened-complete' as const, priority,
})

describe('title rule compilation', () => {
  it('rejects patterns longer than 200 characters', () => {
    expect(isValidTitleRulePattern('a'.repeat(200))).toBe(true)
    expect(isValidTitleRulePattern('a'.repeat(201))).toBe(false)
  })

  it('rejects an over-long pattern in the shared draft schema', () => {
    const verdict = titleRuleDraftSchema.safeParse({
      category: 'pokemon-sealed', pattern: 'a'.repeat(201), kairosCondition: 'opened-complete', priority: 1,
    })
    expect(verdict.success).toBe(false)
  })

  it('skips invalid and over-long rules and orders the rest by priority', () => {
    const compiled = compileTitleRules([rule('(', 5), rule('a'.repeat(201), 9), rule('low', 1), rule('high', 8)])
    expect(compiled.skippedPatterns).toEqual(['(', 'a'.repeat(201)])
    expect(compiled.rules.map(compiledRule => compiledRule.priority)).toEqual([8, 1])
  })
})

describe('structural safety of title rule patterns', () => {
  it.each(['(a+)+$', '^(\\w+\\s?)*$', '(a|aa)+$', '(x)\\1', '(?<n>x)\\k<n>', '(?=a)b', '(?!a)b', '(?<=a)b', '(?<!a)b', '((a+))*', '(a*){2,}'])(
    'rejects %s',
    (pattern) => {
      expect(isValidTitleRulePattern(pattern)).toBe(false)
    },
  )

  it.each(['\\b(vide|empty|sans cartes|incompl)', '(ab[iî]m|cabossé|dented|damaged|enfonc)', '\\b(ouvert|opened|open)\\b', '(?:ab)+', 'a+b*', '[(+]+', '\\(a+\\)+'])(
    'accepts %s',
    (pattern) => {
      expect(isValidTitleRulePattern(pattern)).toBe(true)
    },
  )

  it('skips a stored dangerous rule so resolution does not hang', () => {
    const compiled = compileTitleRules([rule('(a+)+$', 9)])
    expect(compiled.rules).toEqual([])
    const startedAt = Date.now()
    const resolved = resolveKairosConditionWithCompiledRules([], compiled, {
      category: 'pokemon-sealed', source: 'ebay', sourceCondition: null, title: `${'a'.repeat(60)}!`,
    })
    expect(resolved).toBeNull()
    expect(Date.now() - startedAt).toBeLessThan(500)
  })

  it('tests only the first 120 characters of a title', () => {
    const compiled = compileTitleRules([rule('needle', 1)])
    const input = (title: string) => ({ category: 'pokemon-sealed', source: 'ebay', sourceCondition: null, title })
    expect(resolveKairosConditionWithCompiledRules([], compiled, input(`${'x'.repeat(100)} needle`))).toBe('opened-complete')
    expect(resolveKairosConditionWithCompiledRules([], compiled, input(`${'x'.repeat(130)} needle`))).toBeNull()
  })
})
