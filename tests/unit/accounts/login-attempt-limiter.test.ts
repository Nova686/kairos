import { createLoginAttemptLimiter } from '../../../server/domain/accounts/login-attempt-limiter.ts'

const limits = { windowMilliseconds: 60_000, maximumFailuresPerEmail: 3, maximumFailuresPerClientAddress: 5 }

describe('login attempt limiter', () => {
  it('lets attempts through until an email reaches its failure limit, then asks to retry when the oldest failure expires', () => {
    const limiter = createLoginAttemptLimiter(limits)
    const attempt = { clientAddress: '203.0.113.1', email: 'member@example.com' }

    limiter.recordFailure(attempt, 0)
    limiter.recordFailure({ ...attempt, clientAddress: '203.0.113.2' }, 10_000)
    expect(limiter.retryAfterSeconds(attempt, 15_000)).toBeNull()
    limiter.recordFailure({ ...attempt, clientAddress: '203.0.113.3' }, 20_000)

    expect(limiter.retryAfterSeconds({ ...attempt, clientAddress: '198.51.100.9' }, 20_000)).toBe(40)
    expect(limiter.retryAfterSeconds(attempt, 60_001)).toBeNull()
  })

  it('counts an email whatever its case and surrounding spaces', () => {
    const limiter = createLoginAttemptLimiter(limits)

    for (const email of ['Member@Example.com', ' member@example.com', 'MEMBER@EXAMPLE.COM']) {
      limiter.recordFailure({ clientAddress: '203.0.113.1', email }, 0)
    }

    expect(limiter.retryAfterSeconds({ clientAddress: '198.51.100.9', email: 'member@example.com' }, 1_000)).toBe(59)
  })

  it('blocks a client address that reached its failure limit across several emails', () => {
    const limiter = createLoginAttemptLimiter(limits)

    for (let attemptNumber = 0; attemptNumber < 5; attemptNumber += 1) {
      limiter.recordFailure({ clientAddress: '203.0.113.1', email: `guess-${attemptNumber}@example.com` }, 0)
    }

    expect(limiter.retryAfterSeconds({ clientAddress: '203.0.113.1', email: 'other@example.com' }, 0)).toBe(60)
    expect(limiter.retryAfterSeconds({ clientAddress: '203.0.113.2', email: 'other@example.com' }, 0)).toBeNull()
  })

  it('forgets the failures of an email after a successful sign-in but keeps those of the address', () => {
    const limiter = createLoginAttemptLimiter(limits)
    const attempt = { clientAddress: '203.0.113.1', email: 'member@example.com' }
    for (let attemptNumber = 0; attemptNumber < 3; attemptNumber += 1) {
      limiter.recordFailure(attempt, 0)
    }

    limiter.recordSuccess(attempt)
    limiter.recordFailure({ clientAddress: '203.0.113.1', email: 'guess@example.com' }, 0)
    limiter.recordFailure({ clientAddress: '203.0.113.1', email: 'guess@example.com' }, 0)

    expect(limiter.retryAfterSeconds({ ...attempt, clientAddress: '198.51.100.9' }, 0)).toBeNull()
    expect(limiter.retryAfterSeconds(attempt, 0)).toBe(60)
  })

  it('drops the counters whose failures all left the window', () => {
    const limiter = createLoginAttemptLimiter(limits)
    for (let attemptNumber = 0; attemptNumber < 4; attemptNumber += 1) {
      limiter.recordFailure({ clientAddress: `203.0.113.${attemptNumber}`, email: `guess-${attemptNumber}@example.com` }, 0)
    }

    limiter.recordFailure({ clientAddress: '198.51.100.9', email: 'late@example.com' }, 60_001)

    expect(limiter.trackedKeyCount()).toBe(2)
  })
})
