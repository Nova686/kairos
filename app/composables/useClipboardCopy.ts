type ClipboardCopyOutcome = 'idle' | 'copied' | 'failed'

export const useClipboardCopy = () => {
  const copyOutcome = ref<ClipboardCopyOutcome>('idle')

  const copyText = async (text: string) => {
    copyOutcome.value = await copyTextToClipboard(navigator.clipboard, text) ? 'copied' : 'failed'
  }

  return { copyOutcome, copyText }
}
