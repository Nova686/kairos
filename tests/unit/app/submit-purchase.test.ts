import {
  isPurchaseRecorded,
  submitPurchaseWithAdvance,
  validatePurchaseInput,
  type PurchaseSubmissionInput,
  type SubmissionProgress,
} from '../../../app/utils/submit-purchase.ts'

const buildInput = (overrides: Partial<PurchaseSubmissionInput> = {}): PurchaseSubmissionInput => ({
  purchasedOn: '2026-11-02',
  sellerLabel: ' Vinted ',
  totalPriceText: '1 234,5',
  feesText: '',
  isInTransit: false,
  trackingReference: '',
  advancedByPersonId: null,
  advancedAmountText: '',
  lines: [
    {
      productId: 'product-1',
      condition: 'sealed-new',
      isGraded: false,
      gradingCompany: 'PSA',
      grade: '10',
      certificateNumber: '123',
      locationId: null,
    },
  ],
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
    return { purchase: { id: 'purchase-1' } }
  }
  return { sentRequests, sendRequest }
}

describe('validatePurchaseInput', () => {
  it('accepts a complete input', () => {
    expect(validatePurchaseInput(buildInput())).toBe('')
  })

  it('blocks a purchase without lines', () => {
    expect(validatePurchaseInput(buildInput({ lines: [] }))).not.toBe('')
  })

  it('blocks an invalid total, invalid fees and an invalid advanced amount', () => {
    expect(validatePurchaseInput(buildInput({ totalPriceText: 'abc' }))).not.toBe('')
    expect(validatePurchaseInput(buildInput({ feesText: '1,234' }))).not.toBe('')
    expect(validatePurchaseInput(buildInput({ advancedByPersonId: 'person-1', advancedAmountText: '' }))).not.toBe('')
  })

  it('blocks an advanced amount above the purchase cost but accepts the whole cost with fees', () => {
    expect(validatePurchaseInput(buildInput({
      totalPriceText: '100',
      feesText: '5',
      advancedByPersonId: 'person-1',
      advancedAmountText: '105,01',
    }))).toBe('Le montant avancé dépasse le coût de l’achat.')
    expect(validatePurchaseInput(buildInput({
      totalPriceText: '100',
      feesText: '5',
      advancedByPersonId: 'person-1',
      advancedAmountText: '105',
    }))).toBe('')
  })
})

describe('submitPurchaseWithAdvance', () => {
  it('sends euro inputs as integer cents with fees defaulting to zero', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()

    await submitPurchaseWithAdvance(sendRequest, buildInput(), { purchaseId: null })

    expect(sentRequests).toHaveLength(1)
    expect(sentRequests[0]!.path).toBe('/api/purchases')
    expect(sentRequests[0]!.body).toMatchObject({
      purchasedOn: '2026-11-02',
      sellerLabel: 'Vinted',
      totalPriceCents: 123450,
      feesCents: 0,
      inTransit: false,
      trackingReference: null,
    })
  })

  it('keeps the tracking reference only for a purchase in transit and nulls grading fields of non graded lines', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()

    await submitPurchaseWithAdvance(
      sendRequest,
      buildInput({ isInTransit: true, trackingReference: ' AB123 ' }),
      { purchaseId: null },
    )

    const purchaseBody = sentRequests[0]!.body as { inTransit: boolean, trackingReference: string, lines: Record<string, unknown>[] }
    expect(purchaseBody.inTransit).toBe(true)
    expect(purchaseBody.trackingReference).toBe('AB123')
    expect(purchaseBody.lines[0]).toMatchObject({ gradingCompany: null, grade: null, certificateNumber: null })
  })

  it('keeps grading fields of graded lines', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()
    const gradedLine = { ...buildInput().lines[0]!, isGraded: true, condition: 'graded' as const }

    await submitPurchaseWithAdvance(sendRequest, buildInput({ lines: [gradedLine] }), { purchaseId: null })

    const purchaseBody = sentRequests[0]!.body as { lines: Record<string, unknown>[] }
    expect(purchaseBody.lines[0]).toMatchObject({ gradingCompany: 'PSA', grade: '10', certificateNumber: '123' })
  })

  it('creates an i-owe debt linked to the purchase when someone advanced the money', async () => {
    const { sentRequests, sendRequest } = buildRecordingSender()
    const progress: SubmissionProgress = { purchaseId: null }

    await submitPurchaseWithAdvance(
      sendRequest,
      buildInput({ advancedByPersonId: 'person-1', advancedAmountText: '20,5' }),
      progress,
    )

    expect(sentRequests.map(request => request.path)).toEqual(['/api/purchases', '/api/debts'])
    expect(sentRequests[1]!.body).toMatchObject({
      personId: 'person-1',
      amountCents: 2050,
      direction: 'i-owe',
      purchaseId: 'purchase-1',
      createdOn: '2026-11-02',
    })
    expect(progress.purchaseId).toBe('purchase-1')
  })

  it('does not create the purchase again when retrying after a debt failure', async () => {
    const failingSender = buildRecordingSender('/api/debts')
    const progress: SubmissionProgress = { purchaseId: null }
    const input = buildInput({ advancedByPersonId: 'person-1', advancedAmountText: '20' })

    await expect(submitPurchaseWithAdvance(failingSender.sendRequest, input, progress)).rejects.toThrow('network down')
    const retrySender = buildRecordingSender()
    await submitPurchaseWithAdvance(retrySender.sendRequest, input, progress)

    expect(failingSender.sentRequests.map(request => request.path)).toEqual(['/api/purchases', '/api/debts'])
    expect(retrySender.sentRequests.map(request => request.path)).toEqual(['/api/debts'])
    expect(retrySender.sentRequests[0]!.body).toMatchObject({ purchaseId: 'purchase-1' })
  })
})

describe('isPurchaseRecorded', () => {
  it('locks the form once the purchase exists', () => {
    expect(isPurchaseRecorded({ purchaseId: null })).toBe(false)
    expect(isPurchaseRecorded({ purchaseId: 'purchase-1' })).toBe(true)
  })
})
