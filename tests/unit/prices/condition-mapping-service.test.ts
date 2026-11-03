import { describe, expect, it } from 'vitest'
import { resolveKairosCondition } from '../../../shared/prices/resolve-kairos-condition.ts'
import { parseGradeFromTitle } from '../../../shared/prices/parse-grade-from-title.ts'
import { conditionMappingSeeds, titleConditionRuleSeeds } from '../../../server/database/seeds/condition-mappings.ts'

const mappings = conditionMappingSeeds
const rules = titleConditionRuleSeeds.map((rule, index) => ({ id: String(index), ...rule }))

describe('resolveKairosCondition', () => {
  it('lets a title rule override the source condition', () => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'pokemon-sealed',
      source: 'ebay',
      sourceCondition: 'Occasion',
      title: 'ETB Évolutions Prismatiques VIDE',
    })).toBe('opened-incomplete')
  })

  it('detects a damaged box in the title', () => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'pokemon-sealed',
      source: 'ebay',
      sourceCondition: 'Neuf',
      title: 'ETB boîte abîmée',
    })).toBe('sealed-damaged-box')
  })

  it('prefers the highest priority rule', () => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'pokemon-sealed',
      source: 'ebay',
      sourceCondition: 'Neuf',
      title: 'ETB ouvert vide abîmé',
    })).toBe('opened-incomplete')
  })

  it.each([
    ['Display jamais ouvert', 'sealed-new'],
    ['Display non ouvert', 'sealed-new'],
    ['Pokémon video game display', 'sealed-new'],
    ['Display opening day', 'sealed-new'],
    ['ETB boîte abîmée', 'sealed-damaged-box'],
    ['ETB box dented', 'sealed-damaged-box'],
    ['ETB enfoncée sur un coin', 'sealed-damaged-box'],
    ['ETB ouvert', 'opened-complete'],
    ['Booster box opened', 'opened-complete'],
    ['Coffret incomplet', 'opened-incomplete'],
    ['ETB sans cartes', 'opened-incomplete'],
  ])('reads the seeded rules on « %s »', (title, expectedCondition) => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'pokemon-sealed',
      source: 'ebay',
      sourceCondition: 'Neuf',
      title,
    })).toBe(expectedCondition)
  })

  it('seeds the keyword lists of the three sealed rules', () => {
    expect(titleConditionRuleSeeds.map(rule => [rule.priority, rule.keywords])).toEqual([
      [30, ['vide', 'empty', 'sans cartes', 'incompl*']],
      [20, ['ouvert', 'opened', 'open']],
      [10, ['abîm*', 'abim*', 'cabossé*', 'dented', 'damaged', 'enfonc*']],
    ])
  })

  it('maps the source condition when no rule matches', () => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'toy',
      source: 'ebay',
      sourceCondition: 'Neuf',
      title: 'Coffret Lego',
    })).toBe('new-with-tags')
    expect(resolveKairosCondition(mappings, rules, {
      category: 'pokemon-sealed',
      source: 'ebay',
      sourceCondition: 'Neuf : autre (voir détails)',
      title: 'Display',
    })).toBe('sealed-damaged-box')
  })

  it('returns null for an unknown source condition', () => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'toy',
      source: 'ebay',
      sourceCondition: 'Pour pièces',
      title: 'Coffret Lego',
    })).toBeNull()
  })

  it('does not apply title rules of another category', () => {
    expect(resolveKairosCondition(mappings, rules, {
      category: 'toy',
      source: 'ebay',
      sourceCondition: 'Occasion',
      title: 'Jouet vide',
    })).toBe('good')
  })

  it('ignores a rule whose keywords hold no word', () => {
    const emptyRule = { id: 'x', category: 'toy', keywords: ['(('], kairosCondition: 'good' as const, priority: 1 }
    expect(resolveKairosCondition(mappings, [emptyRule], {
      category: 'toy',
      source: 'ebay',
      sourceCondition: 'Neuf',
      title: 'Jouet',
    })).toBe('new-with-tags')
  })
})

describe('parseGradeFromTitle', () => {
  it('reads company and grade', () => {
    expect(parseGradeFromTitle('Dracaufeu PSA 10 Évolutions')).toEqual({ gradingCompany: 'PSA', grade: '10' })
    expect(parseGradeFromTitle('Carte PCA 9.5')).toEqual({ gradingCompany: 'PCA', grade: '9.5' })
    expect(parseGradeFromTitle('Carte CGC10')).toEqual({ gradingCompany: 'CGC', grade: '10' })
    expect(parseGradeFromTitle('Carte Collect Grade 9')).toEqual({ gradingCompany: 'Collect Grade', grade: '9' })
    expect(parseGradeFromTitle('Carte bgs 8.5')).toEqual({ gradingCompany: 'BGS', grade: '8.5' })
    expect(parseGradeFromTitle('Carte CCC 7')).toEqual({ gradingCompany: 'CCC', grade: '7' })
  })

  it('returns null without a grade', () => {
    expect(parseGradeFromTitle('Lot de 10 cartes')).toBeNull()
    expect(parseGradeFromTitle('Carte PSA')).toBeNull()
    expect(parseGradeFromTitle('Carte PSA 11')).toBeNull()
    expect(parseGradeFromTitle('Carte PSA 0')).toBeNull()
  })
})
