import { parseEuroInput } from './format-euros.ts'

export interface ManualPriceFormValues {
  source: string
  condition: string
  isGradedCard: boolean
  gradingCompany: string
  grade: string
  priceText: string
  observedOn: string
  url: string
}

export type ManualPriceBodyOutcome =
  | { body: Record<string, unknown> }
  | { errorMessage: string }

export const buildManualPriceBody = (values: ManualPriceFormValues, todayAsCalendarDate: string): ManualPriceBodyOutcome => {
  const priceCents = parseEuroInput(values.priceText)
  if (priceCents === null || priceCents === 0) {
    return { errorMessage: 'Le prix est invalide.' }
  }
  if (values.observedOn === '') {
    return { errorMessage: 'La date est obligatoire.' }
  }
  if (values.observedOn > todayAsCalendarDate) {
    return { errorMessage: 'La date ne peut pas être dans le futur.' }
  }
  const gradingCompany = values.gradingCompany.trim()
  const grade = values.grade.trim()
  if (values.isGradedCard && (gradingCompany === '' || grade === '')) {
    return { errorMessage: 'Société de gradation et note obligatoires.' }
  }
  const trimmedUrl = values.url.trim()
  return {
    body: {
      source: values.source,
      kairosCondition: values.condition,
      priceCents,
      observedOn: values.observedOn,
      ...(trimmedUrl === '' ? {} : { url: trimmedUrl }),
      ...(values.isGradedCard ? { gradingCompany, grade } : {}),
    },
  }
}
