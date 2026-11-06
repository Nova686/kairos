import { describe, expect, it } from 'vitest'
import { canonicalCompanyName, isSameGradingCompany } from '../../../shared/prices/grading-company.ts'

describe('canonicalCompanyName', () => {
  it('writes known companies in their canonical spelling', () => {
    expect(canonicalCompanyName('psa')).toBe('PSA')
    expect(canonicalCompanyName(' Cgc ')).toBe('CGC')
    expect(canonicalCompanyName('collect   grade')).toBe('Collect Grade')
    expect(canonicalCompanyName('CollectGrade')).toBe('Collect Grade')
  })

  it('trims and collapses the spaces of an unknown company', () => {
    expect(canonicalCompanyName('  Ace   Grading ')).toBe('Ace Grading')
  })
})

describe('isSameGradingCompany', () => {
  it('ignores case and spacing', () => {
    expect(isSameGradingCompany('psa', 'PSA')).toBe(true)
    expect(isSameGradingCompany('ace grading', 'Ace  Grading')).toBe(true)
    expect(isSameGradingCompany('PSA', 'PCA')).toBe(false)
  })
})
