import { conditionCodesFor, conditionLabel, type ConditionCode } from '~~/shared/catalogue/condition-scale'
import type { ProductReference } from '~~/shared/catalogue/product-reference'
import type { LocationRow, PersonRow } from '~~/shared/stock/stock-item-row'
import type { PurchaseSubmissionInput, SendRequest, SubmissionProgress } from '~/utils/submit-purchase'

export interface PurchaseFormLine {
  lineKey: number
  product: ProductReference
  condition: ConditionCode
  gradingCompany: string
  grade: string
  certificateNumber: string
  locationId: string | null
}

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export interface PurchaseLinePrefill {
  gradingCompany: string
  grade: string
  certificateNumber: string
}

export const usePurchaseForm = () => {
  const lines = ref<PurchaseFormLine[]>([])
  const purchasedOn = ref(todayAsLocalCalendarDate())
  const sellerLabel = ref('')
  const totalPriceText = ref('')
  const feesText = ref('')
  const isInTransit = ref(false)
  const trackingReference = ref('')
  const advancedByPersonId = ref<string | null>(null)
  const advancedAmountText = ref('')
  const errorMessage = ref('')
  const isSubmitting = ref(false)
  let nextLineKey = 0
  const submissionProgress = reactive<SubmissionProgress>({ purchaseId: null })
  const isLocked = computed(() => isPurchaseRecorded(submissionProgress))
  const runExclusively = createExclusiveRunner()
  const sendRequest = $fetch as SendRequest

  const { data: fetchedLocations } = useFetch<LocationRow[]>('/api/locations', { default: () => [] })
  const { data: fetchedPersons } = useFetch<PersonRow[]>('/api/persons', { default: () => [] })
  const locations = computed<LocationRow[]>(() => fetchedLocations.value ?? [])
  const persons = computed<PersonRow[]>(() => fetchedPersons.value ?? [])

  const addLine = (product: ProductReference, prefill: PurchaseLinePrefill | null = null) => {
    if (isLocked.value) {
      return
    }
    nextLineKey += 1
    lines.value.push({
      lineKey: nextLineKey,
      product,
      condition: conditionCodesFor(product.category)[0]!,
      gradingCompany: prefill?.gradingCompany ?? '',
      grade: prefill?.grade ?? '',
      certificateNumber: prefill?.certificateNumber ?? '',
      locationId: null,
    })
  }

  const removeLine = (lineKey: number) => {
    lines.value = lines.value.filter(line => line.lineKey !== lineKey)
  }

  const conditionOptionsFor = (line: PurchaseFormLine) =>
    conditionCodesFor(line.product.category).map(code => ({ value: code, title: conditionLabel(code) }))

  const isGradedLine = (line: PurchaseFormLine): boolean => line.product.category === 'graded-card'

  const submissionInput = (): PurchaseSubmissionInput => ({
    purchasedOn: purchasedOn.value,
    sellerLabel: sellerLabel.value,
    totalPriceText: totalPriceText.value,
    feesText: feesText.value,
    isInTransit: isInTransit.value,
    trackingReference: trackingReference.value,
    advancedByPersonId: advancedByPersonId.value,
    advancedAmountText: advancedAmountText.value,
    lines: lines.value.map(line => ({
      productId: line.product.id,
      condition: line.condition,
      isGraded: isGradedLine(line),
      gradingCompany: line.gradingCompany,
      grade: line.grade,
      certificateNumber: line.certificateNumber,
      locationId: line.locationId,
    })),
  })

  const performPurchaseSubmission = async (): Promise<boolean> => {
    errorMessage.value = validatePurchaseInput(submissionInput())
    if (errorMessage.value !== '') {
      return false
    }
    isSubmitting.value = true
    try {
      await submitPurchaseWithAdvance(sendRequest, submissionInput(), submissionProgress)
      return true
    }
    catch (failure) {
      errorMessage.value = submissionProgress.purchaseId === null
        ? describeFailure(failure)
        : `L’achat est enregistré, mais la dette n’a pas pu être créée : ${describeFailure(failure)} Réessayez pour la créer.`
      return false
    }
    finally {
      isSubmitting.value = false
    }
  }

  const submitPurchase = async (): Promise<boolean> => (await runExclusively(performPurchaseSubmission)) ?? false

  return {
    isLocked,
    lines,
    purchasedOn,
    sellerLabel,
    totalPriceText,
    feesText,
    isInTransit,
    trackingReference,
    advancedByPersonId,
    advancedAmountText,
    errorMessage,
    isSubmitting,
    locations,
    persons,
    addLine,
    removeLine,
    conditionOptionsFor,
    isGradedLine,
    submitPurchase,
  }
}

export type PurchaseFormState = ReturnType<typeof usePurchaseForm>
