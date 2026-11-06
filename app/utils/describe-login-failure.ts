type LoginFailure = { statusCode?: number, data?: { statusMessage?: string } }

const tooManyRequestsStatusCode = 429

export const describeLoginFailure = (failure: unknown): string => {
  const loginFailure = failure as LoginFailure
  if (loginFailure.statusCode === tooManyRequestsStatusCode && loginFailure.data?.statusMessage) {
    return loginFailure.data.statusMessage
  }
  return 'Email ou mot de passe incorrect.'
}
