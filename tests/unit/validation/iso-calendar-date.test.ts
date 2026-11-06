import { isoCalendarDateSchema } from '../../../shared/validation/iso-calendar-date.ts'
import { maximumCents, nonNegativeCentsSchema, positiveCentsSchema } from '../../../shared/validation/cents.ts'
import { saleDraftSchema, markSaleDeliveredSchema } from '../../../shared/sales/sale-draft-schema.ts'
import { purchaseDraftSchema, receiveStockItemSchema } from '../../../shared/stock/purchase-draft-schema.ts'
import { debtDraftSchema, settleDebtSchema } from '../../../shared/debts/debt-draft-schema.ts'

describe('isoCalendarDateSchema', () => {
  it.each(['2026-11-02', '2024-02-29', '2026-12-31'])('accepts %s', (calendarDate) => {
    expect(isoCalendarDateSchema.safeParse(calendarDate).success).toBe(true)
  })

  it.each(['2026-13-45', '2026-02-30', '2025-02-29', '2026-00-10', '2026-11-00', '2026-1-2', 'nope', ''])(
    'rejects %s',
    (calendarDate) => {
      expect(isoCalendarDateSchema.safeParse(calendarDate).success).toBe(false)
    },
  )
})

describe('cents schemas', () => {
  it('accepts the int4 maximum and rejects one above', () => {
    expect(nonNegativeCentsSchema.safeParse(maximumCents).success).toBe(true)
    expect(nonNegativeCentsSchema.safeParse(2_147_483_648).success).toBe(false)
    expect(positiveCentsSchema.safeParse(2_147_483_648).success).toBe(false)
    expect(positiveCentsSchema.safeParse(0).success).toBe(false)
  })
})

describe('draft schemas use the shared validations', () => {
  it('rejects impossible dates in every date field', () => {
    expect(markSaleDeliveredSchema.safeParse({ deliveredOn: '2026-02-30' }).success).toBe(false)
    expect(receiveStockItemSchema.safeParse({ receivedOn: '2026-13-45' }).success).toBe(false)
    expect(settleDebtSchema.safeParse({ settledOn: '2026-02-30' }).success).toBe(false)
    expect(debtDraftSchema.safeParse({
      personId: 'p', amountCents: 1, direction: 'owed-to-me', reason: 'r', createdOn: '2026-02-30',
    }).success).toBe(false)
    expect(saleDraftSchema.safeParse({
      soldOn: '2026-02-30', platform: 'v', totalPriceCents: 1, stockItemIds: ['a'],
    }).success).toBe(false)
    expect(purchaseDraftSchema.safeParse({
      purchasedOn: '2026-02-30', totalPriceCents: 1, lines: [{ productId: 'a', condition: 'sealed-new' }],
    }).success).toBe(false)
  })

  it('rejects cents above int4 in every cents field', () => {
    expect(debtDraftSchema.safeParse({
      personId: 'p', amountCents: 2_147_483_648, direction: 'owed-to-me', reason: 'r', createdOn: '2026-11-02',
    }).success).toBe(false)
    expect(saleDraftSchema.safeParse({
      soldOn: '2026-11-02', platform: 'v', totalPriceCents: 1, shippingCostCents: 2_147_483_648, stockItemIds: ['a'],
    }).success).toBe(false)
    expect(purchaseDraftSchema.safeParse({
      purchasedOn: '2026-11-02', totalPriceCents: 2_147_483_648, lines: [{ productId: 'a', condition: 'sealed-new' }],
    }).success).toBe(false)
  })
})
