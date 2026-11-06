export type LoginAttempt = {
  clientAddress: string
  email: string
}

export type LoginAttemptLimits = {
  windowMilliseconds: number
  maximumFailuresPerEmail: number
  maximumFailuresPerClientAddress: number
}

export type LoginAttemptLimiter = {
  retryAfterSeconds: (attempt: LoginAttempt, nowMilliseconds: number) => number | null
  recordFailure: (attempt: LoginAttempt, nowMilliseconds: number) => void
  recordSuccess: (attempt: LoginAttempt) => void
  trackedKeyCount: () => number
}

const emailKeyOf = (attempt: LoginAttempt): string => `email:${attempt.email.trim().toLowerCase()}`

const clientAddressKeyOf = (attempt: LoginAttempt): string => `address:${attempt.clientAddress}`

export const createLoginAttemptLimiter = (limits: LoginAttemptLimits): LoginAttemptLimiter => {
  const failureTimesByKey = new Map<string, number[]>()

  const recentFailureTimes = (key: string, nowMilliseconds: number): number[] =>
    (failureTimesByKey.get(key) ?? []).filter(failureTime => failureTime > nowMilliseconds - limits.windowMilliseconds)

  const forgetExpiredKeys = (nowMilliseconds: number): void => {
    for (const [key, failureTimes] of failureTimesByKey) {
      if (failureTimes.every(failureTime => failureTime <= nowMilliseconds - limits.windowMilliseconds)) {
        failureTimesByKey.delete(key)
      }
    }
  }

  const retryAfterSecondsFor = (key: string, maximumFailures: number, nowMilliseconds: number): number | null => {
    const failureTimes = recentFailureTimes(key, nowMilliseconds)
    if (failureTimes.length < maximumFailures) {
      return null
    }
    const oldestBlockingFailureTime = failureTimes[failureTimes.length - maximumFailures]!
    return Math.ceil((oldestBlockingFailureTime + limits.windowMilliseconds - nowMilliseconds) / 1000)
  }

  return {
    retryAfterSeconds: (attempt, nowMilliseconds) => {
      const waits = [
        retryAfterSecondsFor(emailKeyOf(attempt), limits.maximumFailuresPerEmail, nowMilliseconds),
        retryAfterSecondsFor(clientAddressKeyOf(attempt), limits.maximumFailuresPerClientAddress, nowMilliseconds),
      ].filter(wait => wait !== null)
      return waits.length === 0 ? null : Math.max(...waits)
    },
    recordFailure: (attempt, nowMilliseconds) => {
      forgetExpiredKeys(nowMilliseconds)
      for (const key of [emailKeyOf(attempt), clientAddressKeyOf(attempt)]) {
        failureTimesByKey.set(key, [...recentFailureTimes(key, nowMilliseconds), nowMilliseconds])
      }
    },
    recordSuccess: (attempt) => {
      failureTimesByKey.delete(emailKeyOf(attempt))
    },
    trackedKeyCount: () => failureTimesByKey.size,
  }
}
