import { settleDebt } from '../../../domain/debts/debts-service'
import { settleDebtSchema } from '../../../../shared/debts/debt-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { settledOn } = await readBodyOr422(event, settleDebtSchema)
  return settleDebt(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', settledOn)
})
