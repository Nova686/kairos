import { parseEuroInput } from './format-euros'

export interface PurchaseSubmissionLine {
  productId: string
  condition: string
  isGraded: boolean
  gradingCompany: string
  grade: string
  certificateNumber: string
  locationId: string | null
}

export interface PurchaseSubmissionInput {
  purchasedOn: string
  sellerLabel: string
  totalPriceText: string
  feesText: string
  isInTransit: boolean
  trackingReference: string
  advancedByPersonId: string | null
  advancedAmountText: string
  lines: PurchaseSubmissionLine[]
}

export interface SubmissionProgress {
  purchaseId: string | null
}

export type SendRequest = (path: string, options: { method: string, body: unknown }) => Promise<unknown>

const textOrNull = (text: string): string | null => (text.trim() === '' ? null : text.trim())

const parseFeesCents = (feesText: string): number | null => (feesText.trim() === '' ? 0 : parseEuroInput(feesText))

export const validatePurchaseInput = (input: PurchaseSubmissionInput): string => {
  if (input.lines.length === 0) {
    return 'Ajoutez au moins un produit.'
  }
  if (parseEuroInput(input.totalPriceText) === null) {
    return 'Le prix total est invalide.'
  }
  if (parseFeesCents(input.feesText) === null) {
    return 'Les frais sont invalides.'
  }
  if (input.advancedByPersonId !== null) {
    const advancedAmountCents = parseEuroInput(input.advancedAmountText)
    if (advancedAmountCents === null || advancedAmountCents === 0) {
      return 'Le montant avancé est invalide.'
    }
  }
  return ''
}

const toLineBody = (line: PurchaseSubmissionLine) => ({
  productId: line.productId,
  condition: line.condition,
  gradingCompany: line.isGraded ? textOrNull(line.gradingCompany) : null,
  grade: line.isGraded ? textOrNull(line.grade) : null,
  certificateNumber: line.isGraded ? textOrNull(line.certificateNumber) : null,
  locationId: line.locationId,
})

export const submitPurchaseWithAdvance = async (
  sendRequest: SendRequest,
  input: PurchaseSubmissionInput,
  progress: SubmissionProgress,
): Promise<void> => {
  if (progress.purchaseId === null) {
    const createdPurchase = await sendRequest('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: input.purchasedOn,
        sellerLabel: textOrNull(input.sellerLabel),
        totalPriceCents: parseEuroInput(input.totalPriceText),
        feesCents: parseFeesCents(input.feesText),
        trackingReference: input.isInTransit ? textOrNull(input.trackingReference) : null,
        inTransit: input.isInTransit,
        lines: input.lines.map(toLineBody),
      },
    }) as { purchase: { id: string } }
    progress.purchaseId = createdPurchase.purchase.id
  }
  if (input.advancedByPersonId !== null) {
    await sendRequest('/api/debts', {
      method: 'POST',
      body: {
        personId: input.advancedByPersonId,
        amountCents: parseEuroInput(input.advancedAmountText),
        direction: 'i-owe',
        reason: 'Achat avancé',
        purchaseId: progress.purchaseId,
        createdOn: input.purchasedOn,
      },
    })
  }
}
