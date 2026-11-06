type ClipboardWriter = { writeText: (text: string) => Promise<void> }

export const copyTextToClipboard = async (clipboard: ClipboardWriter | undefined, text: string): Promise<boolean> => {
  if (clipboard === undefined) {
    return false
  }
  try {
    await clipboard.writeText(text)
    return true
  }
  catch {
    return false
  }
}
