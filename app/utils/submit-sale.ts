import { parseEuroInput } from './format-euros.ts'
import type { SendRequest } from './submit-purchase.ts'

export interface SaleSubmissionInput {
  soldOn: string
  platform: string
  buyerPersonId: string | null
  totalPriceText: string
  isShippingIncluded: boolean
  shippingCostText: string
  platformFeesText: string
  packagingCostText: string
  trackingReference: string
  stockItemIds: string[]
  isNotYetPaid: boolean
}

export interface SaleSubmissionProgress {
  saleId: string | null
  createdTotalPriceCents: number | null
}

export const isSaleRecorded = (progress: SaleSubmissionProgress): boolean => progress.saleId !== null

const textOrNull = (text: string): string | null => (text.trim() === '' ? null : text.trim())

const parseOptionalCents = (amountText: string): number | null => (amountText.trim() === '' ? 0 : parseEuroInput(amountText))

export const validateSaleInput = (input: SaleSubmissionInput): string => {
  if (input.stockItemIds.length === 0) {
    return 'Sélectionnez au moins un exemplaire.'
  }
  if (input.platform.trim() === '') {
    return 'La plateforme est obligatoire.'
  }
  if (parseEuroInput(input.totalPriceText) === null) {
    return 'Le prix total est invalide.'
  }
  if (parseOptionalCents(input.shippingCostText) === null) {
    return 'Les frais de port sont invalides.'
  }
  if (parseOptionalCents(input.platformFeesText) === null) {
    return 'Les frais de plateforme sont invalides.'
  }
  if (parseOptionalCents(input.packagingCostText) === null) {
    return 'Le coût d’emballage est invalide.'
  }
  if (input.isNotYetPaid && input.buyerPersonId === null) {
    return 'Choisissez l’acheteur pour enregistrer la dette.'
  }
  return ''
}

export const submitSaleWithDebt = async (
  sendRequest: SendRequest,
  input: SaleSubmissionInput,
  progress: SaleSubmissionProgress,
): Promise<void> => {
  const totalPriceCents = parseEuroInput(input.totalPriceText)
  if (progress.saleId === null) {
    const createdSale = await sendRequest('/api/sales', {
      method: 'POST',
      body: {
        soldOn: input.soldOn,
        platform: input.platform.trim(),
        buyerPersonId: input.buyerPersonId,
        totalPriceCents,
        shippingIncluded: input.isShippingIncluded,
        shippingCostCents: parseOptionalCents(input.shippingCostText),
        platformFeesCents: parseOptionalCents(input.platformFeesText),
        packagingCostCents: parseOptionalCents(input.packagingCostText),
        trackingReference: textOrNull(input.trackingReference),
        stockItemIds: input.stockItemIds,
      },
    }) as { sale: { id: string } }
    progress.saleId = createdSale.sale.id
    progress.createdTotalPriceCents = totalPriceCents
  }
  if (input.isNotYetPaid) {
    await sendRequest('/api/debts', {
      method: 'POST',
      body: {
        personId: input.buyerPersonId,
        amountCents: progress.createdTotalPriceCents,
        direction: 'owed-to-me',
        reason: 'Vente non encore payée',
        saleId: progress.saleId,
        createdOn: input.soldOn,
      },
    })
  }
}
