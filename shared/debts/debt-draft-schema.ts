import { z } from 'zod'
import { positiveCentsSchema } from '../validation/cents.ts'
import { isoCalendarDateSchema as isoDate } from '../validation/iso-calendar-date.ts'

export const debtDraftSchema = z.object({
  personId: z.string().min(1),
  amountCents: positiveCentsSchema,
  direction: z.enum(['owed-to-me', 'i-owe']),
  reason: z.string().trim().min(1),
  purchaseId: z.string().min(1).nullable().default(null),
  saleId: z.string().min(1).nullable().default(null),
  stockItemId: z.string().min(1).nullable().default(null),
  createdOn: isoDate,
})

export const settleDebtSchema = z.object({ settledOn: isoDate })
