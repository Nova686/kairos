import { recordStockValueSnapshots } from '../../domain/valuation/value-stock'

export default defineTask({
  meta: {
    name: 'valuation:record-stock-value',
    description: 'Store today\'s stock value for every user',
  },
  async run() {
    return { result: { recordedUserCount: await recordStockValueSnapshots(await useDatabase(), new Date()) } }
  },
})
