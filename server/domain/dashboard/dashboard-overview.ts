import type { KairosDatabase } from '../../database/open-database.ts'
import { computeDebtBalances } from '../debts/debts-service.ts'
import { listDeliveries } from '../deliveries/list-deliveries.ts'
import { listSales, type SaleWithItems } from '../sales/sales-service.ts'
import { listStockValueHistory, type StockValueSnapshot } from '../valuation/stock-value-history.ts'
import { valueStock, type StockValuation } from '../valuation/value-stock.ts'

const recentSaleCount = 5

export type DashboardOverview = {
  stockValue: Omit<StockValuation, 'items'>
  valueHistory: StockValueSnapshot[]
  recentSales: SaleWithItems[]
  deliveriesInProgress: { incoming: number, outgoing: number }
  debtTotals: { owedToMeCents: number, iOweCents: number }
}

export const dashboardOverview = async (database: KairosDatabase, ownerId: string, now: Date): Promise<DashboardOverview> => {
  const { items: _valuedItems, ...stockValue } = await valueStock(database, ownerId, now)
  const deliveries = await listDeliveries(database, ownerId)
  const debtBalances = await computeDebtBalances(database, ownerId)
  const allSales = await listSales(database, ownerId)
  return {
    stockValue,
    valueHistory: await listStockValueHistory(database, ownerId, now),
    recentSales: allSales.slice(0, recentSaleCount),
    deliveriesInProgress: { incoming: deliveries.incoming.length, outgoing: deliveries.outgoing.length },
    debtTotals: {
      owedToMeCents: debtBalances.reduce((sum, debtBalance) => sum + debtBalance.owedToMeCents, 0),
      iOweCents: debtBalances.reduce((sum, debtBalance) => sum + debtBalance.iOweCents, 0),
    },
  }
}
