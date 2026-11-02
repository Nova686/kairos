export const useSignOut = () => {
  const { clear: clearUserSession } = useUserSession()

  const signOut = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clearUserSession()
    await navigateTo('/connexion')
  }

  return { signOut }
}
