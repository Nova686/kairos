import { describe, expect, it } from 'vitest'
import { describeRequestFailure } from '../../../app/utils/describe-request-failure.ts'

describe('describeRequestFailure', () => {
  it('prefers the server message carried by the response body', () => {
    expect(describeRequestFailure({ data: { statusMessage: 'Dette déjà soldée' }, statusMessage: 'Conflict' })).toBe('Dette déjà soldée')
  })

  it('falls back to the status message, then to the given fallback', () => {
    expect(describeRequestFailure({ statusMessage: 'Introuvable' })).toBe('Introuvable')
    expect(describeRequestFailure(new Error('[GET] /api/sales: fetch failed'))).toBe('Une erreur est survenue.')
    expect(describeRequestFailure(null, 'Photo illisible.')).toBe('Photo illisible.')
  })
})
