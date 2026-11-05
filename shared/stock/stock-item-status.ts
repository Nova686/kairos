export type StockItemStatus = 'in-transit' | 'in-stock' | 'sold-in-transit' | 'sold'

export const stockItemStatuses: StockItemStatus[] = ['in-transit', 'in-stock', 'sold-in-transit', 'sold']

export const heldStockItemStatuses: StockItemStatus[] = ['in-transit', 'in-stock']

export const stockItemStatusLabels: Record<StockItemStatus, string> = {
  'in-transit': 'en livraison',
  'in-stock': 'en stock',
  'sold-in-transit': 'vendu – en livraison',
  'sold': 'vendu',
}

export const isStockItemStatus = (status: string): status is StockItemStatus =>
  (stockItemStatuses as string[]).includes(status)
