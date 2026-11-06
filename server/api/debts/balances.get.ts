import { computeDebtBalances } from '../../domain/debts/debts-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return computeDebtBalances(await useDatabase(), sessionUser.id)
})
