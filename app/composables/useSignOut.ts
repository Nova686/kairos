export const useSignOut = () => {
  const { clear: clearUserSession } = useUserSession()

  const signOut = async () => {
    await clearUserSession()
    await navigateTo('/connexion')
  }

  return { signOut }
}
