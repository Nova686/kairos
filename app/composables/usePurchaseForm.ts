import { conditionCodesFor, conditionLabel, type ConditionCode } from '~~/shared/catalogue/condition-scale'
import type { ProductReference } from '~~/shared/catalogue/product-reference'
import type { LocationRow, PersonRow } from '~~/shared/stock/stock-item-row'

export interface PurchaseFormLine {
  lineKey: number
  product: ProductReference
  condition: ConditionCode
  gradingCompany: string
  grade: string
  certificateNumber: string
  locationId: string | null
}

const todayAsIsoDate = (): string => new Date().toISOString().slice(0, 10)

const textOrNull = (text: string): string | null => (text.trim() === '' ? null : text.trim())

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export const usePurchaseForm = () => {
  const lines = ref<PurchaseFormLine[]>([])
  const purchasedOn = ref(todayAsIsoDate())
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

  const { data: fetchedLocations } = useFetch<LocationRow[]>('/api/locations', { default: () => [] })
  const { data: fetchedPersons } = useFetch<PersonRow[]>('/api/persons', { default: () => [] })
  const locations = computed<LocationRow[]>(() => fetchedLocations.value ?? [])
  const persons = computed<PersonRow[]>(() => fetchedPersons.value ?? [])

  const totalPriceCents = computed(() => parseEuroInput(totalPriceText.value))
  const feesCents = computed(() => (feesText.value.trim() === '' ? 0 : parseEuroInput(feesText.value)))
  const advancedAmountCents = computed(() => parseEuroInput(advancedAmountText.value))

  const addLine = (product: ProductReference) => {
    nextLineKey += 1
    lines.value.push({
      lineKey: nextLineKey,
      product,
      condition: conditionCodesFor(product.category)[0]!,
      gradingCompany: '',
      grade: '',
      certificateNumber: '',
      locationId: null,
    })
  }

  const removeLine = (lineKey: number) => {
    lines.value = lines.value.filter(line => line.lineKey !== lineKey)
  }

  const conditionOptionsFor = (line: PurchaseFormLine) =>
    conditionCodesFor(line.product.category).map(code => ({ value: code, title: conditionLabel(code) }))

  const isGradedLine = (line: PurchaseFormLine): boolean => line.product.category === 'graded-card'

  const toLineDraft = (line: PurchaseFormLine) => ({
    productId: line.product.id,
    condition: line.condition,
    gradingCompany: isGradedLine(line) ? textOrNull(line.gradingCompany) : null,
    grade: isGradedLine(line) ? textOrNull(line.grade) : null,
    certificateNumber: isGradedLine(line) ? textOrNull(line.certificateNumber) : null,
    locationId: line.locationId,
  })

  const validationMessage = (): string => {
    if (lines.value.length === 0) {
      return 'Ajoutez au moins un produit.'
    }
    if (totalPriceCents.value === null) {
      return 'Le prix total est invalide.'
    }
    if (feesCents.value === null) {
      return 'Les frais sont invalides.'
    }
    if (advancedByPersonId.value !== null && (advancedAmountCents.value === null || advancedAmountCents.value === 0)) {
      return 'Le montant avancé est invalide.'
    }
    return ''
  }

  const submitPurchase = async (): Promise<boolean> => {
    errorMessage.value = validationMessage()
    if (errorMessage.value !== '') {
      return false
    }
    isSubmitting.value = true
    try {
      const createdPurchase = await $fetch<{ purchase: { id: string } }>('/api/purchases', {
        method: 'POST',
        body: {
          purchasedOn: purchasedOn.value,
          sellerLabel: textOrNull(sellerLabel.value),
          totalPriceCents: totalPriceCents.value,
          feesCents: feesCents.value,
          trackingReference: isInTransit.value ? textOrNull(trackingReference.value) : null,
          inTransit: isInTransit.value,
          lines: lines.value.map(toLineDraft),
        },
      })
      if (advancedByPersonId.value !== null) {
        await $fetch('/api/debts', {
          method: 'POST',
          body: {
            personId: advancedByPersonId.value,
            amountCents: advancedAmountCents.value,
            direction: 'i-owe',
            reason: 'Achat avancé',
            purchaseId: createdPurchase.purchase.id,
            createdOn: purchasedOn.value,
          },
        })
      }
      return true
    }
    catch (failure) {
      errorMessage.value = describeFailure(failure)
      return false
    }
    finally {
      isSubmitting.value = false
    }
  }

  return {
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
