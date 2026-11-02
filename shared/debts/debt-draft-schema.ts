import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const debtDraftSchema = z.object({
  personId: z.string().min(1),
  amountCents: z.number().int().positive(),
  direction: z.enum(['owed-to-me', 'i-owe']),
  reason: z.string().trim().min(1),
  purchaseId: z.string().min(1).nullable().default(null),
  saleId: z.string().min(1).nullable().default(null),
  stockItemId: z.string().min(1).nullable().default(null),
  createdOn: isoDate,
})

export const settleDebtSchema = z.object({ settledOn: isoDate })
