import { persons } from '../../database/schema/index'
import { findOwnedOr404 } from '../../domain/ownership/find-owned-or-404'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return findOwnedOr404(await useDatabase(), persons, getRouterParam(event, 'id') ?? '', sessionUser.id)
})
