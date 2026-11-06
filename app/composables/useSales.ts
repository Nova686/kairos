import { allocateSaleNetCents, computeSaleNetCents } from '~~/shared/money/sale-profit'
import type { PersonRow, StockItemRow } from '~~/shared/stock/stock-item-row'
import type { SaleSubmissionInput, SaleSubmissionProgress } from '~/utils/submit-sale'
import type { SendRequest } from '~/utils/submit-purchase'

export interface SaleListRow {
  id: string
  soldOn: string
  platform: string
  totalPriceCents: number
  saleNetCents: number
  netProfitCents: number
  trackingReference: string | null
  deliveredOn: string | null
  items: { stockItemId: string, productName: string }[]
}

export const platformSuggestions = ['Vinted', 'eBay', 'Leboncoin', 'Cardmarket', 'Main propre']

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export const useSales = () => {
  const { data: fetchedSales, pending } = useFetch<SaleListRow[]>('/api/sales', { default: () => [] })
  const sales = computed<SaleListRow[]>(() => fetchedSales.value ?? [])

  return { sales, pending }
}

export const useSaleForm = () => {
  const soldOn = ref(todayAsLocalCalendarDate())
  const platform = ref<string | null>('')
  const buyerPersonId = ref<string | null>(null)
  const totalPriceText = ref('')
  const isShippingIncluded = ref(false)
  const shippingCostText = ref('')
  const platformFeesText = ref('')
  const packagingCostText = ref('')
  const trackingReference = ref('')
  const selectedStockItemIds = ref<string[]>([])
  const isNotYetPaid = ref(false)
  const errorMessage = ref('')
  const isSubmitting = ref(false)
  const submissionProgress = reactive<SaleSubmissionProgress>({ saleId: null, createdTotalPriceCents: null })
  const isLocked = computed(() => isSaleRecorded(submissionProgress))
  const runExclusively = createExclusiveRunner()
  const sendRequest = $fetch as SendRequest

  const { data: fetchedStockItems } = useFetch<StockItemRow[]>('/api/stock-items', {
    query: { status: 'in-stock' },
    default: () => [],
  })
  const { data: fetchedPersons } = useFetch<PersonRow[]>('/api/persons', { default: () => [] })
  const availableStockItems = computed<StockItemRow[]>(() => fetchedStockItems.value ?? [])
  const persons = computed<PersonRow[]>(() => fetchedPersons.value ?? [])

  const stockItemOptions = computed(() => availableStockItems.value.map(stockItem => ({
    value: stockItem.id,
    title: `${stockItem.productName} · ${describeStockItemCondition(stockItem.condition, stockItem.gradingCompany, stockItem.grade)} · ${formatEuros(stockItem.allocatedPurchaseCents)}`,
  })))
  const personOptions = computed(() => persons.value.map(person => ({ value: person.id, title: person.name })))

  const centsOrZero = (amountText: string): number => parseEuroInput(amountText) ?? 0

  const selectedStockItems = computed(() =>
    availableStockItems.value.filter(stockItem => selectedStockItemIds.value.includes(stockItem.id)),
  )

  const saleNetCents = computed(() => computeSaleNetCents({
    totalPriceCents: centsOrZero(totalPriceText.value),
    platformFeesCents: centsOrZero(platformFeesText.value),
    packagingCostCents: centsOrZero(packagingCostText.value),
    shippingIncluded: isShippingIncluded.value,
    shippingCostCents: centsOrZero(shippingCostText.value),
  }))

  const purchaseCostCents = computed(() =>
    selectedStockItems.value.reduce((sum, stockItem) => sum + stockItem.allocatedPurchaseCents, 0),
  )

  const netProfitCents = computed(() => {
    if (selectedStockItems.value.length === 0) {
      return 0
    }
    const allocatedSaleCents = allocateSaleNetCents(
      saleNetCents.value,
      selectedStockItems.value.map(stockItem => stockItem.allocatedPurchaseCents),
    )
    return allocatedSaleCents.reduce((sum, allocation) => sum + allocation, 0) - purchaseCostCents.value
  })

  const submissionInput = (): SaleSubmissionInput => ({
    soldOn: soldOn.value,
    platform: platform.value ?? '',
    buyerPersonId: buyerPersonId.value,
    totalPriceText: totalPriceText.value,
    isShippingIncluded: isShippingIncluded.value,
    shippingCostText: shippingCostText.value,
    platformFeesText: platformFeesText.value,
    packagingCostText: packagingCostText.value,
    trackingReference: trackingReference.value,
    stockItemIds: selectedStockItemIds.value,
    isNotYetPaid: isNotYetPaid.value,
  })

  const performSaleSubmission = async (): Promise<boolean> => {
    errorMessage.value = validateSaleInput(submissionInput())
    if (errorMessage.value !== '') {
      return false
    }
    isSubmitting.value = true
    try {
      await submitSaleWithDebt(sendRequest, submissionInput(), submissionProgress)
      return true
    }
    catch (failure) {
      errorMessage.value = submissionProgress.saleId === null
        ? describeFailure(failure)
        : `La vente est enregistrée, mais la dette n’a pas pu être créée : ${describeFailure(failure)} Réessayez pour la créer.`
      return false
    }
    finally {
      isSubmitting.value = false
    }
  }

  const submitSale = async (): Promise<boolean> => (await runExclusively(performSaleSubmission)) ?? false

  return {
    isLocked,
    soldOn,
    platform,
    buyerPersonId,
    totalPriceText,
    isShippingIncluded,
    shippingCostText,
    platformFeesText,
    packagingCostText,
    trackingReference,
    selectedStockItemIds,
    isNotYetPaid,
    errorMessage,
    isSubmitting,
    stockItemOptions,
    personOptions,
    saleNetCents,
    purchaseCostCents,
    netProfitCents,
    submitSale,
  }
}
