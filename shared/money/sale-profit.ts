import { allocateCents } from './allocate-cents.ts'

export type SaleCosts = {
  totalPriceCents: number
  platformFeesCents: number
  packagingCostCents: number
  shippingIncluded: boolean
  shippingCostCents: number
}

export const computeSaleNetCents = (sale: SaleCosts): number =>
  sale.totalPriceCents
  - sale.platformFeesCents
  - sale.packagingCostCents
  - (sale.shippingIncluded ? sale.shippingCostCents : 0)

export const allocateSaleNetCents = (saleNetCents: number, weights: number[]): number[] =>
  saleNetCents < 0
    ? allocateCents(-saleNetCents, weights).map(share => -share)
    : allocateCents(saleNetCents, weights)
