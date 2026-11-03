import { ref } from 'vue'
import type { ProductCandidate } from '../../server/domain/catalogue/search-product-candidates.ts'
import type { PhotoDegradedReason } from '../../server/domain/scan/identify-photo.ts'
import type { ProductReference } from '../../shared/catalogue/product-reference.ts'
import { createExclusiveRunner } from '../utils/run-exclusively.ts'
import type { ScanRequestSender } from './useScanIdentification.ts'

interface PhotoIdentificationResponse {
  autoPicked: ProductCandidate | null
  candidates: ProductCandidate[]
  uploadFingerprint: string
  degradedReasons: PhotoDegradedReason[]
  unavailableSources: string[]
}

export interface PhotoIdentificationHandlers {
  onProductReady: (product: ProductReference) => void
  onProductWithdrawn: (productId: string) => void
}

const degradedReasonMessages: Record<PhotoDegradedReason, string> = {
  'image-embedder-unavailable': 'La reconnaissance visuelle est indisponible pour le moment.',
  'text-reader-unavailable': 'La lecture du texte est indisponible pour le moment.',
}

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? fetchFailure.message ?? 'Une erreur est survenue.'
}

const toProductReference = (candidate: ProductCandidate): ProductReference => ({
  id: candidate.productId!,
  name: candidate.draft.name,
  category: candidate.draft.category,
})

export const usePhotoIdentification = (
  handlers: PhotoIdentificationHandlers,
  sendRequest: ScanRequestSender,
  resizeBeforeUpload: (file: File) => Promise<Blob>,
) => {
  const isAnalysing = ref(false)
  const errorMessage = ref('')
  const candidates = ref<ProductCandidate[]>([])
  const autoPickedProduct = ref<ProductReference | null>(null)
  const degradedMessages = ref<string[]>([])
  const unavailableSources = ref<string[]>([])
  const uploadFingerprint = ref<string | null>(null)
  const hasAnalysed = ref(false)
  const runExclusively = createExclusiveRunner()

  const resetOutcome = () => {
    errorMessage.value = ''
    candidates.value = []
    autoPickedProduct.value = null
    degradedMessages.value = []
    unavailableSources.value = []
    uploadFingerprint.value = null
    hasAnalysed.value = false
  }

  const performAnalysis = async (file: File): Promise<void> => {
    resetOutcome()
    isAnalysing.value = true
    try {
      const body = new FormData()
      body.append('photo', await resizeBeforeUpload(file), 'photo.jpg')
      const outcome = await sendRequest<PhotoIdentificationResponse>('/api/scan/photo', { method: 'POST', body })
      candidates.value = outcome.candidates
      degradedMessages.value = outcome.degradedReasons.map(reason => degradedReasonMessages[reason])
      unavailableSources.value = outcome.unavailableSources
      uploadFingerprint.value = outcome.uploadFingerprint
      hasAnalysed.value = true
      if (outcome.autoPicked?.productId) {
        autoPickedProduct.value = toProductReference(outcome.autoPicked)
        handlers.onProductReady(autoPickedProduct.value)
      }
    }
    catch (failure) {
      errorMessage.value = describeFailure(failure)
    }
    finally {
      isAnalysing.value = false
    }
  }

  const analyse = async (file: File): Promise<void> => {
    await runExclusively(() => performAnalysis(file))
  }

  const rejectAutoPick = () => {
    if (autoPickedProduct.value === null) {
      return
    }
    handlers.onProductWithdrawn(autoPickedProduct.value.id)
    autoPickedProduct.value = null
  }

  const pickProduct = async (product: ProductReference): Promise<void> => {
    if (uploadFingerprint.value !== null) {
      try {
        await sendRequest('/api/scan/photo/confirm', {
          method: 'POST',
          body: { uploadFingerprint: uploadFingerprint.value, productId: product.id },
        })
      }
      catch {
        errorMessage.value = ''
      }
    }
    handlers.onProductReady(product)
  }

  return {
    isAnalysing,
    errorMessage,
    candidates,
    autoPickedProduct,
    degradedMessages,
    unavailableSources,
    hasAnalysed,
    analyse,
    rejectAutoPick,
    pickProduct,
  }
}
