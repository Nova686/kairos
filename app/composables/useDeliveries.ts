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

export const isTrackingLink = (trackingReference: string): boolean => /^https?:\/\//i.test(trackingReference)

export const useDeliveries = () => {
  const { data: fetchedDeliveries, refresh, pending } = useFetch<DeliveriesPayload>('/api/deliveries', {
    default: () => ({ incoming: [], outgoing: [] }),
  })
  const incoming = computed<IncomingDeliveryRow[]>(() => fetchedDeliveries.value?.incoming ?? [])
  const outgoing = computed<OutgoingDeliveryRow[]>(() => fetchedDeliveries.value?.outgoing ?? [])
  const errorMessage = ref('')
  const sendRequest = $fetch as (path: string, options: { method: string, body: unknown }) => Promise<unknown>

  const pendingActionKeys = ref<string[]>([])
  const isActionPending = (actionKey: string): boolean => pendingActionKeys.value.includes(actionKey)

  const runAction = async (actionKey: string, path: string, body: Record<string, string>) => {
    if (isActionPending(actionKey)) {
      return
    }
    pendingActionKeys.value.push(actionKey)
    errorMessage.value = ''
    try {
      await sendRequest(path, { method: 'POST', body })
      await refresh()
    }
    catch (failure) {
      errorMessage.value = describeRequestFailure(failure)
    }
    finally {
      pendingActionKeys.value = pendingActionKeys.value.filter(pendingKey => pendingKey !== actionKey)
    }
  }

  const markReceived = (stockItemId: string) =>
    runAction(stockItemId, `/api/stock-items/${stockItemId}/receive`, { receivedOn: todayAsLocalCalendarDate() })

  const markDelivered = (saleId: string) =>
    runAction(saleId, `/api/sales/${saleId}/delivered`, { deliveredOn: todayAsLocalCalendarDate() })

  return { incoming, outgoing, pending, errorMessage, isActionPending, markReceived, markDelivered }
}
