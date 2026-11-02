import type { ConditionCode } from '~~/shared/catalogue/condition-scale'

export interface ManualPriceFormOption {
  value: string
  title: string
}

export const manualPriceSourceOptions: ManualPriceFormOption[] = [
  { value: 'vinted', title: 'Vinted' },
  { value: 'leboncoin', title: 'Leboncoin' },
  { value: 'other', title: 'Autre' },
]

export const useManualPriceForm = (
  readConditionOptions: () => ManualPriceFormOption[],
  readIsGradedCard: () => boolean,
  saveManualPrice: (body: Record<string, unknown>) => Promise<boolean>,
) => {
  const source = ref('vinted')
  const condition = ref<ConditionCode | string>(readConditionOptions()[0]?.value ?? '')
  const gradingCompany = ref('')
  const grade = ref('')
  const priceText = ref('')
  const observedOn = ref(todayAsParisCalendarDate())
  const url = ref('')
  const errorMessage = ref('')

  const maximumObservedOn = computed(() => todayAsParisCalendarDate())

  const submitManualPrice = async () => {
    const outcome = buildManualPriceBody({
      source: source.value,
      condition: condition.value,
      isGradedCard: readIsGradedCard(),
      gradingCompany: gradingCompany.value,
      grade: grade.value,
      priceText: priceText.value,
      observedOn: observedOn.value,
      url: url.value,
    }, todayAsParisCalendarDate())
    if ('errorMessage' in outcome) {
      errorMessage.value = outcome.errorMessage
      return false
    }
    const isSaved = await saveManualPrice(outcome.body)
    errorMessage.value = isSaved ? '' : 'Le prix n’a pas pu être enregistré.'
    if (isSaved) {
      priceText.value = ''
      url.value = ''
    }
    return isSaved
  }

  return {
    source,
    condition,
    gradingCompany,
    grade,
    priceText,
    observedOn,
    url,
    errorMessage,
    maximumObservedOn,
    submitManualPrice,
  }
}
