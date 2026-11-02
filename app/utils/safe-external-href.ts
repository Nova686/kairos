const allowedProtocols = ['http:', 'https:']

export const safeExternalHref = (candidateUrl: string | null | undefined): string | undefined => {
  if (!candidateUrl) {
    return undefined
  }
  try {
    const parsedUrl = new URL(candidateUrl.trim())
    return allowedProtocols.includes(parsedUrl.protocol) ? parsedUrl.href : undefined
  }
  catch {
    return undefined
  }
}
