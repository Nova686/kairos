import { createInvitation } from '../../domain/accounts/accounts-service'

export default defineEventHandler(async (event) => {
  const administrator = await requireAdminSessionUser(event)
  const { code, expiresAt } = await createInvitation(await useDatabase(), administrator.id)
  return { code, expiresAt: expiresAt.toISOString() }
})
