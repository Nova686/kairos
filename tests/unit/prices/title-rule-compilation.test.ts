import { describe, expect, it } from 'vitest'
import { titleRuleDraftSchema } from '../../../shared/prices/condition-mapping-schemas.ts'
import { compileTitleRules, isValidTitleRulePattern } from '../../../shared/prices/resolve-kairos-condition.ts'

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
