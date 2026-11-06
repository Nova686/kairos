import { createDebt } from '../../domain/debts/debts-service'
import { debtDraftSchema } from '../../../shared/debts/debt-draft-schema'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const debtDraft = await readBodyOr422(event, debtDraftSchema)
  return createDebt(await useDatabase(), sessionUser.id, debtDraft)
})
