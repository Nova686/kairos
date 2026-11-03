import { describe, expect, it } from 'vitest'
import { conditionKeptInCategory } from '../../../app/utils/condition-in-category.ts'

describe('conditionKeptInCategory', () => {
  it('keeps a condition that belongs to the new category', () => {
    expect(conditionKeptInCategory('toy', 'good')).toBe('good')
  })

  it('falls back to the first condition of the new category otherwise', () => {
    expect(conditionKeptInCategory('toy', 'sealed-new')).toBe('new-with-tags')
    expect(conditionKeptInCategory('pokemon-sealed', 'good')).toBe('sealed-new')
  })
})
