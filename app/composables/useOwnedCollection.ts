type FetchFailure = { statusMessage?: string, data?: { statusMessage?: string } }

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as FetchFailure
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export const useOwnedCollection = <TRow extends { id: string }>(endpoint: string) => {
  const { data: fetchedRows, refresh, pending } = useFetch<TRow[]>(endpoint, { default: () => [] })
  const rows = computed<TRow[]>(() => fetchedRows.value ?? [])
  const errorMessage = ref('')

  const runMutation = async (mutation: () => Promise<unknown>): Promise<boolean> => {
    errorMessage.value = ''
    try {
      await mutation()
      await refresh()
      return true
    }
    catch (failure) {
      errorMessage.value = describeFailure(failure)
      return false
    }
  }

  const sendRequest = $fetch as (path: string, options: { method: string, body?: unknown }) => Promise<unknown>

  const rowEndpoint = (rowId: string): string => `${endpoint}/${rowId}`

  const createRow = (body: Record<string, unknown>): Promise<boolean> =>
    runMutation(() => sendRequest(endpoint, { method: 'POST', body }))

  const updateRow = (rowId: string, body: Record<string, unknown>): Promise<boolean> =>
    runMutation(() => sendRequest(rowEndpoint(rowId), { method: 'PATCH', body }))

  const deleteRow = (rowId: string): Promise<boolean> =>
    runMutation(() => sendRequest(rowEndpoint(rowId), { method: 'DELETE' }))

  return { rows, refresh, createRow, updateRow, deleteRow, pending, errorMessage }
}
