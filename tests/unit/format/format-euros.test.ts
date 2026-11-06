import { formatEuros, parseEuroInput } from '../../../app/utils/format-euros.ts'

describe('formatEuros', () => {
  it('formats cents with the French currency format', () => {
    expect(formatEuros(123456)).toBe(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(1234.56))
    expect(formatEuros(123456)).toMatch(/^1\s234,56\s€$/)
    expect(formatEuros(5)).toMatch(/^0,05\s€$/)
  })
})

describe('parseEuroInput', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['1 234,56', 123456],
    ['1\u202f234,56', 123456],
    ['1\u00a0234,56', 123456],
    ['  7 € ', 700],
    ['0', 0],
  ])('reads %s as %i cents', (typedAmount, expectedCents) => {
    expect(parseEuroInput(typedAmount)).toBe(expectedCents)
  })

  it.each(['abc', '', '-5', '12,345', '1,2,3', '12.50.1'])('rejects %s', (typedAmount) => {
    expect(parseEuroInput(typedAmount)).toBeNull()
  })
})
