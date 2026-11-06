import { z } from 'zod'
import { conditionCodes } from '../catalogue/condition-scale.ts'
import { isoCalendarDateSchema as isoDate } from '../validation/iso-calendar-date.ts'
import { nonNegativeCentsSchema as nonNegativeCents } from '../validation/cents.ts'

const optionalText = z.string().trim().min(1).nullable()

export const purchaseLineDraftSchema = z.object({
  productId: z.string().min(1),
  condition: z.enum(conditionCodes),
  gradingCompany: optionalText.default(null),
  grade: optionalText.default(null),
  certificateNumber: optionalText.default(null),
  locationId: z.string().min(1).nullable().default(null),
  allocatedPurchaseCents: nonNegativeCents.nullable().default(null),
})

export const purchaseDraftSchema = z.object({
  purchasedOn: isoDate,
  sellerLabel: optionalText.default(null),
  totalPriceCents: nonNegativeCents,
  feesCents: nonNegativeCents.default(0),
  trackingReference: optionalText.default(null),
  inTransit: z.boolean().default(false),
  lines: z.array(purchaseLineDraftSchema).min(1),
})

export const stockItemChangesSchema = z.object({
  condition: z.enum(conditionCodes),
  locationId: z.string().min(1).nullable(),
  notes: z.string().nullable(),
  gradingCompany: optionalText,
  grade: optionalText,
  certificateNumber: optionalText,
}).partial().strict()

export const receiveStockItemSchema = z.object({ receivedOn: isoDate })
