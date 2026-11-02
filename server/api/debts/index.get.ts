import { listDebts } from '../../domain/debts/debts-service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const { settled } = getQuery(event)
  if (settled !== undefined && settled !== 'true' && settled !== 'false') {
    throw createError({ statusCode: 422, statusMessage: 'Paramètre settled invalide' })
  }
  return listDebts(await useDatabase(), sessionUser.id, settled === undefined ? {} : { settled: settled === 'true' })
})
