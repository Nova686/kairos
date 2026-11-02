import { z } from 'zod'
import { isoCalendarDateSchema as isoDate } from '../validation/iso-calendar-date.ts'
import { nonNegativeCentsSchema as nonNegativeCents } from '../validation/cents.ts'

export const saleDraftSchema = z.object({
  soldOn: isoDate,
  platform: z.string().trim().min(1),
  buyerPersonId: z.string().min(1).nullable().default(null),
  totalPriceCents: nonNegativeCents,
  shippingIncluded: z.boolean().default(false),
  shippingCostCents: nonNegativeCents.default(0),
  platformFeesCents: nonNegativeCents.default(0),
  packagingCostCents: nonNegativeCents.default(0),
  trackingReference: z.string().trim().min(1).nullable().default(null),
  stockItemIds: z.array(z.string().min(1)).min(1),
})

export const markSaleDeliveredSchema = z.object({ deliveredOn: isoDate })
