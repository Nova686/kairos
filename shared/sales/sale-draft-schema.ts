import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nonNegativeCents = z.number().int().min(0)

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
