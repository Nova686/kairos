import type { H3Event } from 'h3'
import { isAdministrator, type SessionUser } from '../domain/accounts/accounts-service'

export const requireSessionUser = async (event: H3Event): Promise<SessionUser> => {
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentification requise' })
  }
  return user
}

export const requireAdminSessionUser = async (event: H3Event): Promise<SessionUser> => {
  const sessionUser = await requireSessionUser(event)
  if (!await isAdministrator(await useDatabase(), sessionUser.id)) {
    throw createError({ statusCode: 403, statusMessage: 'Réservé aux administrateurs' })
  }
  return sessionUser
}
