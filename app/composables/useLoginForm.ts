export const useLoginForm = () => {
  const { fetch: refreshUserSession } = useUserSession()
  const email = ref('')
  const password = ref('')
  const errorMessage = ref('')
  const isSubmitting = ref(false)

  const submitLogin = async () => {
    isSubmitting.value = true
    errorMessage.value = ''
    try {
      await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
      await refreshUserSession()
      await navigateTo('/')
    }
    catch {
      errorMessage.value = 'Email ou mot de passe incorrect.'
    }
    finally {
      isSubmitting.value = false
    }
  }

  return { email, password, errorMessage, isSubmitting, submitLogin }
}
