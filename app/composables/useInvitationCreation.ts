export const useInvitationCreation = () => {
  const invitationLink = ref('')
  const errorMessage = ref('')
  const hasCopiedLink = ref(false)
  const isCreating = ref(false)

  const createInvitationLink = async () => {
    isCreating.value = true
    errorMessage.value = ''
    hasCopiedLink.value = false
    try {
      const { code } = await $fetch<{ code: string }>('/api/invitations', { method: 'POST' })
      invitationLink.value = `${window.location.origin}/invitation/${code}`
    }
    catch {
      errorMessage.value = 'Impossible de créer l\'invitation.'
    }
    finally {
      isCreating.value = false
    }
  }

  const copyInvitationLink = async () => {
    await navigator.clipboard.writeText(invitationLink.value)
    hasCopiedLink.value = true
  }

  return { invitationLink, errorMessage, hasCopiedLink, isCreating, createInvitationLink, copyInvitationLink }
}
