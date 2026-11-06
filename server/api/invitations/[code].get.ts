import { isInvitationAvailable } from '../../domain/accounts/accounts-service'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!await isInvitationAvailable(await useDatabase(), code)) {
    throw createError({ statusCode: 410, statusMessage: 'Invitation invalide, utilisée ou expirée' })
  }
  return { available: true }
})
