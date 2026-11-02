import {
  isSaleRecorded,
  submitSaleWithDebt,
  validateSaleInput,
  type SaleSubmissionInput,
  type SaleSubmissionProgress,
} from '../../../app/utils/submit-sale.ts'

const buildInput = (overrides: Partial<SaleSubmissionInput> = {}): SaleSubmissionInput => ({
  soldOn: '2026-11-02',
  platform: ' Vinted ',
  buyerPersonId: null,
  totalPriceText: '95,5',
  isShippingIncluded: true,
  shippingCostText: '6',
  platformFeesText: '',
  packagingCostText: '1,2',
  trackingReference: ' LP123 ',
  stockItemIds: ['stock-item-1', 'stock-item-2'],
  isNotYetPaid: false,
  ...overrides,
})

type SentRequest = { path: string, method: string, body: Record<string, unknown> }

const buildRecordingSender = (failingPath?: string) => {
  const sentRequests: SentRequest[] = []
  const sendRequest = async (path: string, options: { method: string, body: unknown }) => {
    sentRequests.push({ path, method: options.method, body: options.body as Record<string, unknown> })
    if (path === failingPath) {
      throw new Error('network down')
    }
    return { sale: { id: 'sale-1' } }
  }
  return { sentRequests, sendRequest }
}

describe('validateSaleInput', () => {
  it('accepts a complete input', () => {
    expect(validateSaleInput(buildInput())).toBe('')
  })

  it('blocks a sale without items, without platform or with invalid amounts', () => {
    expect(validateSaleInput(buildInput({ stockItemIds: [] }))).not.toBe('')
    expect(validateSaleInput(buildInput({ platform: '  ' }))).not.toBe('')
    expect(validateSaleInput(buildInput({ totalPriceText: 'abc' }))).not.toBe('')
    expect(validateSaleInput(buildInput({ platformFeesText: '1,234' }))).not.toBe('')
  })

  it('requires a buyer when the sale is not yet paid', () => {
    expect(validateSaleInput(buildInput({ isNotYetPaid: true, buyerPersonId: null }))).not.toBe('')
    expect(validateSaleInput(buildInput({ isNotYetPaid: true, buyerPersonId: 'person-1' }))).toBe('')
  })
})

describe('submitSaleWithDebt', () => {
  it('sends euro inputs as integer cents with fees defaulting to zero and shippingIncluded', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()

    await submitSaleWithDebt(sendRequest, buildInput(), { saleId: null, createdTotalPriceCents: null })

    expect(sentRequests).toHaveLength(1)
    expect(sentRequests[0]!.path).toBe('/api/sales')
    expect(sentRequests[0]!.body).toEqual({
      soldOn: '2026-11-02',
      platform: 'Vinted',
      buyerPersonId: null,
      totalPriceCents: 9550,
      shippingIncluded: true,
      shippingCostCents: 600,
      platformFeesCents: 0,
      packagingCostCents: 120,
      trackingReference: 'LP123',
      stockItemIds: ['stock-item-1', 'stock-item-2'],
    })
  })

  it('sends a null tracking reference when blank', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()

    await submitSaleWithDebt(sendRequest, buildInput({ trackingReference: '  ' }), { saleId: null, createdTotalPriceCents: null })

    expect(sentRequests[0]!.body).toMatchObject({ trackingReference: null })
  })

  it('creates an owed-to-me debt for the sale total when the buyer has not paid yet', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()
    const progress: SaleSubmissionProgress = { saleId: null, createdTotalPriceCents: null }

    await submitSaleWithDebt(sendRequest, buildInput({ isNotYetPaid: true, buyerPersonId: 'person-1' }), progress)

    expect(sentRequests.map(request => request.path)).toEqual(['/api/sales', '/api/debts'])
    expect(sentRequests[1]!.body).toMatchObject({
      personId: 'person-1',
      amountCents: 9550,
      direction: 'owed-to-me',
      saleId: 'sale-1',
      createdOn: '2026-11-02',
    })
    expect(progress.saleId).toBe('sale-1')
  })

  it('does not create the sale again when retrying after a debt failure', async () => {
    const failingSender = buildRecordingSender('/api/debts')
    const progress: SaleSubmissionProgress = { saleId: null, createdTotalPriceCents: null }
    const input = buildInput({ isNotYetPaid: true, buyerPersonId: 'person-1' })

    await expect(submitSaleWithDebt(failingSender.sendRequest, input, progress)).rejects.toThrow('network down')
    const retrySender = buildRecordingSender()
    await submitSaleWithDebt(retrySender.sendRequest, input, progress)

    expect(failingSender.sentRequests.map(request => request.path)).toEqual(['/api/sales', '/api/debts'])
    expect(retrySender.sentRequests.map(request => request.path)).toEqual(['/api/debts'])
    expect(retrySender.sentRequests[0]!.body).toMatchObject({ saleId: 'sale-1' })
  })

  it('takes the retried debt amount from the created sale, not from the edited form', async () => {
    const failingSender = buildRecordingSender('/api/debts')
    const progress: SaleSubmissionProgress = { saleId: null, createdTotalPriceCents: null }
    const input = buildInput({ isNotYetPaid: true, buyerPersonId: 'person-1' })

    await expect(submitSaleWithDebt(failingSender.sendRequest, input, progress)).rejects.toThrow('network down')
    const retrySender = buildRecordingSender()
    await submitSaleWithDebt(retrySender.sendRequest, { ...input, totalPriceText: '1' }, progress)

    expect(retrySender.sentRequests[0]!.body).toMatchObject({ amountCents: 9550 })
  })
})

describe('isSaleRecorded', () => {
  it('locks the form once the sale exists', () => {
    expect(isSaleRecorded({ saleId: null, createdTotalPriceCents: null })).toBe(false)
    expect(isSaleRecorded({ saleId: 'sale-1', createdTotalPriceCents: 100 })).toBe(true)
  })
})
