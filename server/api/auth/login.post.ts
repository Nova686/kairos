import { z } from 'zod'
import { verifyCredentials } from '../../domain/accounts/accounts-service'

const loginBodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, loginBodySchema.parse)
  const sessionUser = await verifyCredentials(await useDatabase(), email, password, nitroPasswordHasher)
  if (!sessionUser) {
    throw createError({ statusCode: 401, statusMessage: 'Email ou mot de passe incorrect' })
  }
  await setUserSession(event, { user: sessionUser })
  return sessionUser
})
