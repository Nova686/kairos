import { describe, expect, it } from 'vitest'
import { titleRuleDraftSchema } from '../../../shared/prices/condition-mapping-schemas.ts'
import { compileTitleRules, resolveKairosConditionWithCompiledRules } from '../../../shared/prices/resolve-kairos-condition.ts'

const rule = (keywords: string[], priority = 1) => ({
  id: keywords.join('-'), category: 'pokemon-sealed', keywords, kairosCondition: 'opened-complete' as const, priority,
})

const resolveTitle = (keywords: string[], title: string) =>
  resolveKairosConditionWithCompiledRules([], compileTitleRules([rule(keywords)]), {
    category: 'pokemon-sealed', source: 'ebay', sourceCondition: null, title,
  })

describe('keyword title rules', () => {
  it('matches whole words only, ignoring case and accents', () => {
    expect(resolveTitle(['ouvert'], 'Display OUVERT')).toBe('opened-complete')
    expect(resolveTitle(['cabossé'], 'ETB cabosse')).toBe('opened-complete')
    expect(resolveTitle(['ouvert'], 'Display ouverture')).toBeNull()
    expect(resolveTitle(['vide'], 'Pokémon video game')).toBeNull()
    expect(resolveTitle(['open'], 'Display opening ceremony')).toBeNull()
  })

  it('matches the start of a word when the keyword ends with a star', () => {
    expect(resolveTitle(['abîm*'], 'ETB boîte ABIMEE')).toBe('opened-complete')
    expect(resolveTitle(['abim*'], 'ETB boîte abîmée')).toBe('opened-complete')
    expect(resolveTitle(['incompl*'], 'Coffret incomplet')).toBe('opened-complete')
    expect(resolveTitle(['abim*'], 'ETB abim')).toBe('opened-complete')
  })

  it('does not match in the middle of a word', () => {
    expect(resolveTitle(['vide*'], 'Display invidement')).toBeNull()
    expect(resolveTitle(['open*'], 'Display reopened')).toBeNull()
  })

  it('ignores a match preceded by a negation', () => {
    expect(resolveTitle(['ouvert'], 'Display jamais ouvert')).toBeNull()
    expect(resolveTitle(['ouvert'], 'Display non ouvert')).toBeNull()
    expect(resolveTitle(['ouvert'], 'Display pas ouvert')).toBeNull()
    expect(resolveTitle(['opened'], 'Booster box never opened')).toBeNull()
    expect(resolveTitle(['damaged'], 'Box not damaged')).toBeNull()
    expect(resolveTitle(['sans cartes'], 'ETB pas sans cartes')).toBeNull()
  })

  it('still matches a later occurrence that is not negated', () => {
    expect(resolveTitle(['ouvert'], 'Display jamais ouvert puis ouvert')).toBe('opened-complete')
    expect(resolveTitle(['ouvert'], 'Display non scellé ouvert')).toBe('opened-complete')
  })

  it('matches a phrase as consecutive word starts', () => {
    expect(resolveTitle(['sans cartes'], 'ETB Sans cartes promo')).toBe('opened-complete')
    expect(resolveTitle(['sans cartes'], 'ETB sans les cartes')).toBeNull()
    expect(resolveTitle(['sans cartes'], 'ETB cartes sans')).toBeNull()
  })

  it('treats regular expression syntax as plain text', () => {
    expect(resolveTitle(['(a+)+$'], 'lot a !')).toBe('opened-complete')
    expect(resolveTitle(['(a+)+$'], `${'a'.repeat(60)}!`)).toBeNull()
    expect(resolveTitle(['(a+)+$'], 'bbbb')).toBeNull()
    expect(resolveTitle(['.*'], 'Display')).toBeNull()
  })

  it('stays fast on an adversarial 120-character title against many keywords', () => {
    const keywords = Array.from({ length: 20 }, (_, index) => `${'a'.repeat(30)} ${'a'.repeat(9)}${index}`)
    const compiled = compileTitleRules([rule(keywords, 9)])
    const title = 'a '.repeat(60)
    const startedAt = performance.now()
    const resolved = resolveKairosConditionWithCompiledRules([], compiled, {
      category: 'pokemon-sealed', source: 'ebay', sourceCondition: null, title,
    })
    expect(resolved).toBeNull()
    expect(performance.now() - startedAt).toBeLessThan(50)
  })

  it('orders compiled rules by priority', () => {
    const compiled = compileTitleRules([rule(['low'], 1), rule(['high'], 8)])
    expect(compiled.rules.map(compiledRule => compiledRule.priority)).toEqual([8, 1])
  })
})

describe('title rule draft schema', () => {
  const draft = (keywords: string[]) => ({ category: 'pokemon-sealed', keywords, kairosCondition: 'opened-complete', priority: 1 })

  it('accepts 1 to 20 keywords of 2 to 40 characters after trimming', () => {
    expect(titleRuleDraftSchema.safeParse(draft([' vide ', 'a'.repeat(40), 'abîm*'])).success).toBe(true)
    expect(titleRuleDraftSchema.safeParse(draft(Array.from({ length: 20 }, () => 'ab'))).success).toBe(true)
  })

  it.each([
    [[]],
    [['a']],
    [[' a ']],
    [['a'.repeat(41)]],
    [Array.from({ length: 21 }, () => 'ab')],
    [['a*']],
    [['ab*c']],
    [['**']],
  ])('rejects %j', (keywords) => {
    expect(titleRuleDraftSchema.safeParse(draft(keywords)).success).toBe(false)
  })
})
