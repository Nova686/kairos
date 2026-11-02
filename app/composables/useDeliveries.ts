export interface IncomingDeliveryRow {
  stockItemId: string
  productName: string
  trackingReference: string | null
  purchasedOn: string
}

export interface OutgoingDeliveryRow {
  saleId: string
  productNames: string[]
  trackingReference: string | null
  soldOn: string
}

interface DeliveriesPayload {
  incoming: IncomingDeliveryRow[]
  outgoing: OutgoingDeliveryRow[]
}

const describeFailure = (failure: unknown): string => {
  const fetchFailure = failure as { data?: { statusMessage?: string }, statusMessage?: string }
  return fetchFailure.data?.statusMessage ?? fetchFailure.statusMessage ?? 'Une erreur est survenue.'
}

export const isTrackingLink = (trackingReference: string): boolean => trackingReference.startsWith('http')

export const useDeliveries = () => {
  const { data: fetchedDeliveries, refresh, pending } = useFetch<DeliveriesPayload>('/api/deliveries', {
    default: () => ({ incoming: [], outgoing: [] }),
  })
  const incoming = computed<IncomingDeliveryRow[]>(() => fetchedDeliveries.value?.incoming ?? [])
  const outgoing = computed<OutgoingDeliveryRow[]>(() => fetchedDeliveries.value?.outgoing ?? [])
  const errorMessage = ref('')
  const sendRequest = $fetch as (path: string, options: { method: string, body: unknown }) => Promise<unknown>

  const runAction = async (path: string, body: Record<string, string>) => {
    errorMessage.value = ''
    try {
      await sendRequest(path, { method: 'POST', body })
      await refresh()
    }
    catch (failure) {
      errorMessage.value = describeFailure(failure)
    }
  }

  const markReceived = (stockItemId: string) =>
    runAction(`/api/stock-items/${stockItemId}/receive`, { receivedOn: todayAsLocalCalendarDate() })

  const markDelivered = (saleId: string) =>
    runAction(`/api/sales/${saleId}/delivered`, { deliveredOn: todayAsLocalCalendarDate() })

  return { incoming, outgoing, pending, errorMessage, markReceived, markDelivered }
}
