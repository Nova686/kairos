import type { StockItemStatus } from './stock-item-status.ts'

export interface StockItemRow {
  id: string
  productId: string
  purchaseId: string
  productName: string
  productImageUrl: string | null
  productCategory: string
  condition: string
  gradingCompany: string | null
  grade: string | null
  certificateNumber: string | null
  allocatedPurchaseCents: number
  locationId: string | null
  status: StockItemStatus
  notes: string | null
  receivedOn: string | null
}

export interface LocationRow {
  id: string
  label: string
}

export interface PersonRow {
  id: string
  name: string
}
