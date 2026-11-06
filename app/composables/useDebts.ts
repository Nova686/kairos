import type { PersonRow } from '~~/shared/stock/stock-item-row'

export interface DebtRow {
  id: string
  personId: string
  personName: string
  amountCents: number
  direction: 'owed-to-me' | 'i-owe'
  reason: string
  createdOn: string
  settledOn: string | null
  stockItemProductName: string | null
}

export interface DebtBalanceRow {
  personId: string
  personName: string
  owedToMeCents: number
  iOweCents: number
  balanceCents: number
}

export const debtDirectionLabels: Record<DebtRow['direction'], string> = {
  'owed-to-me': 'On me doit',
  'i-owe': 'Je dois',
}

export const useDebts = () => {
  const { data: fetchedBalances, refresh: refreshBalances } = useFetch<DebtBalanceRow[]>('/api/debts/balances', { default: () => [] })
  const { data: fetchedOpenDebts, refresh: refreshOpenDebts } = useFetch<DebtRow[]>('/api/debts', {
    key: 'open-debts',
    query: { settled: 'false' },
    default: () => [],
  })
  const { data: fetchedSettledDebts, refresh: refreshSettledDebts } = useFetch<DebtRow[]>('/api/debts', {
    key: 'settled-debts',
    query: { settled: 'true' },
    default: () => [],
  })
  const { data: fetchedPersons } = useFetch<PersonRow[]>('/api/persons', { default: () => [] })

  const balances = computed<DebtBalanceRow[]>(() => fetchedBalances.value ?? [])
  const openDebts = computed<DebtRow[]>(() => fetchedOpenDebts.value ?? [])
  const settledDebts = computed<DebtRow[]>(() => fetchedSettledDebts.value ?? [])
  const persons = computed<PersonRow[]>(() => fetchedPersons.value ?? [])
  const errorMessage = ref('')
  const sendRequest = $fetch as (path: string, options: { method: string, body: unknown }) => Promise<unknown>

  const refreshAll = () => Promise.all([refreshBalances(), refreshOpenDebts(), refreshSettledDebts()])

  const runMutation = async (mutation: () => Promise<unknown>): Promise<boolean> => {
    errorMessage.value = ''
    try {
      await mutation()
      await refreshAll()
      return true
    }
    catch (failure) {
      errorMessage.value = describeRequestFailure(failure)
      return false
    }
  }

  const settleDebt = (debtId: string) =>
    runMutation(() => sendRequest(`/api/debts/${debtId}/settle`, {
      method: 'POST',
      body: { settledOn: todayAsLocalCalendarDate() },
    }))

  const createDebt = (body: Record<string, unknown>) =>
    runMutation(() => sendRequest('/api/debts', { method: 'POST', body }))

  return { balances, openDebts, settledDebts, persons, errorMessage, settleDebt, createDebt }
}

export const useDebtForm = (
  readPersons: () => PersonRow[],
  createDebt: (body: Record<string, unknown>) => Promise<boolean>,
) => {
  const personId = ref<string | null>(null)
  const direction = ref<DebtRow['direction']>('owed-to-me')
  const amountText = ref('')
  const reason = ref('')
  const createdOn = ref(todayAsLocalCalendarDate())
  const errorMessage = ref('')

  const personOptions = computed(() => readPersons().map(person => ({ value: person.id, title: person.name })))
  const directionOptions = (Object.keys(debtDirectionLabels) as DebtRow['direction'][])
    .map(directionCode => ({ value: directionCode, title: debtDirectionLabels[directionCode] }))

  const submitDebt = async () => {
    const amountCents = parseEuroInput(amountText.value)
    if (personId.value === null) {
      errorMessage.value = 'Choisissez une personne.'
      return
    }
    if (amountCents === null || amountCents === 0) {
      errorMessage.value = 'Le montant est invalide.'
      return
    }
    if (reason.value.trim() === '') {
      errorMessage.value = 'Le motif est obligatoire.'
      return
    }
    const isCreated = await createDebt({
      personId: personId.value,
      amountCents,
      direction: direction.value,
      reason: reason.value.trim(),
      createdOn: createdOn.value,
    })
    errorMessage.value = isCreated ? '' : 'La dette n’a pas pu être créée.'
    if (isCreated) {
      amountText.value = ''
      reason.value = ''
    }
  }

  return { personId, direction, amountText, reason, createdOn, errorMessage, personOptions, directionOptions, submitDebt }
}
