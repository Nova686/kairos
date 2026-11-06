import { describe, expect, it } from 'vitest'
import { buildManualPriceBody, type ManualPriceFormValues } from '../../../app/utils/build-manual-price-body.ts'

const validValues = (overrides: Partial<ManualPriceFormValues> = {}): ManualPriceFormValues => ({
  source: 'vinted',
  condition: 'very-good',
  isGradedCard: false,
  gradingCompany: '',
  grade: '',
  priceText: '25,50',
  observedOn: '2026-11-01',
  url: '',
  ...overrides,
})

const today = '2026-11-02'

describe('buildManualPriceBody', () => {
  it('builds the request body with the price in cents and no empty optional field', () => {
    expect(buildManualPriceBody(validValues(), today)).toEqual({
      body: { source: 'vinted', kairosCondition: 'very-good', priceCents: 2550, observedOn: '2026-11-01' },
    })
  })

  it('includes the trimmed link and the grading fields of a graded card', () => {
    const outcome = buildManualPriceBody(
      validValues({ isGradedCard: true, condition: 'graded', gradingCompany: ' PSA ', grade: '10', url: ' https://www.vinted.fr/items/1 ' }),
      today,
    )

    expect(outcome).toEqual({
      body: {
        source: 'vinted',
        kairosCondition: 'graded',
        priceCents: 2550,
        observedOn: '2026-11-01',
        url: 'https://www.vinted.fr/items/1',
        gradingCompany: 'PSA',
        grade: '10',
      },
    })
  })

  it('refuses an invalid or zero price', () => {
    expect(buildManualPriceBody(validValues({ priceText: 'abc' }), today)).toEqual({ errorMessage: 'Le prix est invalide.' })
    expect(buildManualPriceBody(validValues({ priceText: '0' }), today)).toEqual({ errorMessage: 'Le prix est invalide.' })
  })

  it('refuses a missing or future date', () => {
    expect(buildManualPriceBody(validValues({ observedOn: '' }), today)).toEqual({ errorMessage: 'La date est obligatoire.' })
    expect(buildManualPriceBody(validValues({ observedOn: '2026-11-03' }), today)).toEqual({ errorMessage: 'La date ne peut pas être dans le futur.' })
  })

  it('refuses a graded card without company or grade', () => {
    expect(buildManualPriceBody(validValues({ isGradedCard: true, condition: 'graded' }), today))
      .toEqual({ errorMessage: 'Société de gradation et note obligatoires.' })
  })
})
