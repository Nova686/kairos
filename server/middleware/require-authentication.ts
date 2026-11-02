const publicLoginPattern = /^\/api\/auth\/login$/
const publicInvitationLookupPattern = /^\/api\/invitations\/[^/]+$/
const publicInvitationAcceptancePattern = /^\/api\/invitations\/[^/]+\/accept$/
const libraryOwnSessionPattern = /^\/api\/_auth\/session$/

export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)
  if (!pathname.startsWith('/api/')) {
    return
  }
  const isPublicLogin = event.method === 'POST' && publicLoginPattern.test(pathname)
  const isPublicInvitationLookup = event.method === 'GET' && publicInvitationLookupPattern.test(pathname)
  const isPublicInvitationAcceptance = event.method === 'POST' && publicInvitationAcceptancePattern.test(pathname)
  const isLibraryOwnSessionAccess = ['GET', 'DELETE'].includes(event.method) && libraryOwnSessionPattern.test(pathname)
  if (isPublicLogin || isPublicInvitationLookup || isPublicInvitationAcceptance || isLibraryOwnSessionAccess) {
    return
  }
  await requireSessionUser(event)
})
