import { conditionCodesFor, conditionLabel, isConditionAllowed } from '../../../shared/catalogue/condition-scale.ts'

describe('condition scale', () => {
  it('refuses a general condition on sealed Pokémon products', () => {
    expect(isConditionAllowed('pokemon-sealed', 'good')).toBe(false)
    expect(isConditionAllowed('pokemon-sealed', 'sealed-new')).toBe(true)
  })

  it('lists conditions best first and labels them in French', () => {
    expect(conditionCodesFor('toy')[0]).toBe('new-with-tags')
    expect(conditionCodesFor('graded-card')).toEqual(['graded'])
    expect(conditionLabel('sealed-damaged-box')).toBe('neuf boîte abîmée')
  })
})
