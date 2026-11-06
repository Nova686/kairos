import { createLoginAttemptLimiter } from '../domain/accounts/login-attempt-limiter'

export const loginAttemptLimiter = createLoginAttemptLimiter({
  windowMilliseconds: 60_000,
  maximumFailuresPerEmail: 5,
  maximumFailuresPerClientAddress: 10,
})
