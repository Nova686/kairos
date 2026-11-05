import { describe, expect, it } from 'vitest'
import { pluralizeFrench } from '../../../app/utils/pluralize-french.ts'

describe('pluralizeFrench', () => {
  it('keeps the singular for zero and one, as French does', () => {
    expect(pluralizeFrench(0, 'exemplaire')).toBe('0 exemplaire')
    expect(pluralizeFrench(1, 'exemplaire')).toBe('1 exemplaire')
  })

  it('uses the plural from two and accepts an irregular one', () => {
    expect(pluralizeFrench(2, 'exemplaire')).toBe('2 exemplaires')
    expect(pluralizeFrench(3, 'annonce')).toBe('3 annonces')
    expect(pluralizeFrench(2, 'cheval', 'chevaux')).toBe('2 chevaux')
  })
})
