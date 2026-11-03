import { computed, ref } from 'vue'
import type { ProductCandidate } from '../../server/domain/catalogue/search-product-candidates.ts'
import type { ProductReference } from '../../shared/catalogue/product-reference.ts'
import { classifyScannedCode } from '../utils/classify-scanned-code.ts'
import { describeUnavailableIdentificationSources } from '../utils/unavailable-source-message.ts'

export interface ScanProductPrefill {
  gradingCompany: string
  grade: string
  certificateNumber: string
}

interface BarcodeIdentificationResponse {
  barcode: string
  knownProduct: ProductReference | null
  candidates: ProductCandidate[]
  unavailableSources: string[]
}

interface PsaIdentificationResponse {
  candidates: ProductCandidate[]
  prefilledStockItem: ScanProductPrefill | null
  unavailableSources: string[]
}

export type ScanRequestSender = <TResponse>(url: string, options?: { method?: 'POST', body?: unknown }) => Promise<TResponse>

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export const useScanIdentification = (
  onProductReady: (product: ProductReference, prefill: ScanProductPrefill | null) => void,
  sendRequest: ScanRequestSender,
) => {
  const isPsaMode = ref(false)
  const isIdentifying = ref(false)
  const errorMessage = ref('')
  const noticeMessage = ref('')
  const identifiedCandidates = ref<ProductCandidate[]>([])
  const unavailableSources = ref<string[]>([])
  const pendingBarcode = ref<string | null>(null)
  const pendingPrefill = ref<ScanProductPrefill | null>(null)
  let latestIdentificationNumber = 0

  const isUnknownCode = computed(() => pendingBarcode.value !== null && identifiedCandidates.value.length === 0)
  const unavailableSourcesMessage = computed(() => describeUnavailableIdentificationSources(unavailableSources.value))

  const resetOutcome = () => {
    identifiedCandidates.value = []
    unavailableSources.value = []
    pendingBarcode.value = null
    pendingPrefill.value = null
    errorMessage.value = ''
    noticeMessage.value = ''
  }

  const identify = async (rawCode: string): Promise<void> => {
    resetOutcome()
    latestIdentificationNumber += 1
    const classifiedCode = classifyScannedCode(rawCode, isPsaMode.value)
    if (classifiedCode.kind === 'invalid') {
      isIdentifying.value = false
      errorMessage.value = isPsaMode.value
        ? 'Numéro de certificat invalide : 7 à 10 chiffres.'
        : 'Code-barres invalide.'
      return
    }
    const identificationNumber = latestIdentificationNumber
    isIdentifying.value = true
    try {
      if (classifiedCode.kind === 'barcode') {
        const outcome = await sendRequest<BarcodeIdentificationResponse>(`/api/scan/barcode/${classifiedCode.barcode}`)
        if (identificationNumber !== latestIdentificationNumber) {
          return
        }
        if (outcome.knownProduct) {
          onProductReady(
            { id: outcome.knownProduct.id, name: outcome.knownProduct.name, category: outcome.knownProduct.category },
            null,
          )
          return
        }
        identifiedCandidates.value = outcome.candidates
        unavailableSources.value = outcome.unavailableSources
        pendingBarcode.value = classifiedCode.barcode
        return
      }
      const outcome = await sendRequest<PsaIdentificationResponse>(`/api/scan/psa/${classifiedCode.certificateNumber}`)
      if (identificationNumber !== latestIdentificationNumber) {
        return
      }
      identifiedCandidates.value = outcome.candidates
      unavailableSources.value = outcome.unavailableSources
      pendingPrefill.value = outcome.prefilledStockItem
    }
    catch (failure) {
      if (identificationNumber === latestIdentificationNumber) {
        errorMessage.value = describeFailure(failure)
      }
    }
    finally {
      if (identificationNumber === latestIdentificationNumber) {
        isIdentifying.value = false
      }
    }
  }

  const pickProduct = async (product: ProductReference): Promise<void> => {
    const barcodeToLink = pendingBarcode.value
    errorMessage.value = ''
    noticeMessage.value = ''
    if (barcodeToLink !== null) {
      try {
        await sendRequest(`/api/scan/barcode/${barcodeToLink}/link`, { method: 'POST', body: { productId: product.id } })
        noticeMessage.value = 'Code-barres associé.'
        pendingBarcode.value = null
      }
      catch (failure) {
        errorMessage.value = `Le code-barres n’a pas pu être associé : ${describeFailure(failure)}`
      }
    }
    const prefillToApply = pendingPrefill.value
    pendingPrefill.value = null
    onProductReady(product, prefillToApply)
  }

  return {
    isPsaMode,
    isIdentifying,
    errorMessage,
    noticeMessage,
    identifiedCandidates,
    unavailableSources,
    unavailableSourcesMessage,
    isUnknownCode,
    pendingBarcode,
    identify,
    pickProduct,
  }
}
