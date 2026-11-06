type RequestFailure = { data?: { statusMessage?: string }, statusMessage?: string } | null | undefined

export const describeRequestFailure = (failure: unknown, fallbackMessage = 'Une erreur est survenue.'): string => {
  const requestFailure = failure as RequestFailure
  return requestFailure?.data?.statusMessage ?? requestFailure?.statusMessage ?? fallbackMessage
}
