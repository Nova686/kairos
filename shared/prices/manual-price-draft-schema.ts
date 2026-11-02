import { z } from 'zod'
import { conditionCodes } from '../catalogue/condition-scale.ts'
import { isoCalendarDateSchema } from '../validation/iso-calendar-date.ts'
import { positiveCentsSchema } from '../validation/cents.ts'

export const manualPriceSources = ['vinted', 'leboncoin', 'other'] as const

const isWebUrl = (candidate: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(candidate).protocol)
  }
  catch {
    return false
  }
}

export const manualPriceDraftSchema = z.object({
  source: z.enum(manualPriceSources),
  kairosCondition: z.enum(conditionCodes),
  gradingCompany: z.string().trim().min(1).nullish(),
  grade: z.string().trim().min(1).nullish(),
  priceCents: positiveCentsSchema,
  observedOn: isoCalendarDateSchema,
  url: z.string().trim().refine(isWebUrl, { message: 'Lien http ou https attendu' }).nullish(),
})

export type ManualPriceDraft = z.infer<typeof manualPriceDraftSchema>
