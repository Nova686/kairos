const publicLoginPattern = /^\/api\/auth\/login$/
const publicInvitationLookupPattern = /^\/api\/invitations\/[^/]+$/
const publicInvitationAcceptancePattern = /^\/api\/invitations\/[^/]+\/accept$/
const libraryOwnSessionPattern = /^\/api\/_auth\/session$/
const publicHealthPattern = /^\/api\/health$/

export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)
  if (!pathname.startsWith('/api/')) {
    return
  }
  const isPublicLogin = event.method === 'POST' && publicLoginPattern.test(pathname)
  const isPublicInvitationLookup = event.method === 'GET' && publicInvitationLookupPattern.test(pathname)
  const isPublicInvitationAcceptance = event.method === 'POST' && publicInvitationAcceptancePattern.test(pathname)
  const isLibraryOwnSessionAccess = ['GET', 'DELETE'].includes(event.method) && libraryOwnSessionPattern.test(pathname)
  const isPublicHealth = event.method === 'GET' && publicHealthPattern.test(pathname)
  if (isPublicHealth || isPublicLogin || isPublicInvitationLookup || isPublicInvitationAcceptance || isLibraryOwnSessionAccess) {
    return
  }
  await requireSessionUser(event)
})
