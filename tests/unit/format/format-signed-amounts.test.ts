import { formatSignedEuros, formatSignedPercent } from '../../../app/utils/format-euros.ts'

describe('formatSignedEuros', () => {
  it('prefixes a gain with a plus sign and leaves losses and zero as formatted', () => {
    expect(formatSignedEuros(8633)).toMatch(/^\+86,33\s€$/)
    expect(formatSignedEuros(0)).toMatch(/^0,00\s€$/)
    expect(formatSignedEuros(-250)).toMatch(/^[-−]2,50\s€$/)
  })
})

describe('formatSignedPercent', () => {
  it('shows a ratio as a signed percentage with one decimal', () => {
    expect(formatSignedPercent(0.504)).toMatch(/^\+50,4\s%$/)
    expect(formatSignedPercent(-0.12)).toMatch(/^[-−]12,0\s%$/)
    expect(formatSignedPercent(0)).toMatch(/^0,0\s%$/)
  })
})
