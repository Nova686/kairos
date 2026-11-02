const publicPathPattern = /^\/(connexion|invitation\/[^/]+)\/?$/

export default defineNuxtRouteMiddleware((destination) => {
  const { loggedIn } = useUserSession()
  const isPublicDestination = publicPathPattern.test(destination.path)
  if (!loggedIn.value && !isPublicDestination) {
    return navigateTo('/connexion')
  }
  if (loggedIn.value && destination.path === '/connexion') {
    return navigateTo('/')
  }
})
