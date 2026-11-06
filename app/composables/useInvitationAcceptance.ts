export const useInvitationAcceptance = (invitationCode: string) => {
  const { fetch: refreshUserSession } = useUserSession()
  const email = ref('')
  const displayName = ref('')
  const password = ref('')
  const errorMessage = ref('')
  const isSubmitting = ref(false)
  const { error: invitationLookupError } = useFetch(`/api/invitations/${invitationCode}`)
  const isInvitationUnavailable = computed(() => invitationLookupError.value !== undefined && invitationLookupError.value !== null)

  const submitAcceptance = async () => {
    isSubmitting.value = true
    errorMessage.value = ''
    try {
      await $fetch(`/api/invitations/${invitationCode}/accept`, {
        method: 'POST',
        body: { email: email.value, displayName: displayName.value, password: password.value },
      })
      await refreshUserSession()
      await navigateTo('/')
    }
    catch (failure) {
      const statusCode = (failure as { statusCode?: number }).statusCode
      errorMessage.value = statusCode === 409
        ? 'Cet email est déjà utilisé.'
        : statusCode === 410
          ? 'Cette invitation n\'est plus valable.'
          : 'Impossible de créer le compte : vérifiez les champs (mot de passe de 10 caractères minimum).'
    }
    finally {
      isSubmitting.value = false
    }
  }

  return { email, displayName, password, errorMessage, isSubmitting, isInvitationUnavailable, submitAcceptance }
}
