import { z } from 'zod'
import { verifyCredentials } from '../../domain/accounts/accounts-service'
import { resolveClientAddress } from '../../domain/accounts/resolve-client-address'

const loginBodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readBodyOr422(event, loginBodySchema)
  const clientAddress = resolveClientAddress({
    socketAddress: event.node.req.socket.remoteAddress ?? null,
    forwardedFor: getRequestHeader(event, 'x-forwarded-for') ?? null,
    trustsProxyHeaders: useRuntimeConfig(event).trustProxyHeaders === true,
  })
  const loginAttempt = { clientAddress, email }
  const retryAfterSeconds = loginAttemptLimiter.retryAfterSeconds(loginAttempt, Date.now())
  if (retryAfterSeconds !== null) {
    setResponseHeader(event, 'Retry-After', retryAfterSeconds)
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives de connexion. Réessayez dans une minute.' })
  }
  const sessionUser = await verifyCredentials(await useDatabase(), email, password, nitroPasswordHasher)
  if (!sessionUser) {
    loginAttemptLimiter.recordFailure(loginAttempt, Date.now())
    throw createError({ statusCode: 401, statusMessage: 'Email ou mot de passe incorrect' })
  }
  loginAttemptLimiter.recordSuccess(loginAttempt)
  await setUserSession(event, { user: sessionUser })
  return sessionUser
})
