import { z } from 'zod'
import {
  EmailAlreadyUsedError,
  InvitationUnavailableError,
  acceptInvitation,
  minimumPasswordLength,
} from '../../../domain/accounts/accounts-service'

const acceptInvitationBodySchema = z.object({
  email: z.string().trim().pipe(z.email()),
  displayName: z.string().trim().min(1),
  password: z.string().min(minimumPasswordLength),
})

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  const newAccount = await readValidatedBody(event, acceptInvitationBodySchema.parse)
  const invitedUser = await acceptInvitation(await useDatabase(), code, newAccount, nitroPasswordHasher)
    .catch((failure: unknown) => {
      if (failure instanceof InvitationUnavailableError) {
        throw createError({ statusCode: 410, statusMessage: 'Invitation invalide, utilisée ou expirée' })
      }
      if (failure instanceof EmailAlreadyUsedError) {
        throw createError({ statusCode: 409, statusMessage: 'Cet email est déjà utilisé' })
      }
      throw failure
    })
  await setUserSession(event, { user: invitedUser })
  return invitedUser
})
