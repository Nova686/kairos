import { describe, expect, it } from 'vitest'
import { describeLoginFailure } from '../../../app/utils/describe-login-failure.ts'

describe('describeLoginFailure', () => {
  it('relays the server message when too many attempts were made', () => {
    expect(describeLoginFailure({ statusCode: 429, data: { statusMessage: 'Trop de tentatives de connexion. Réessayez dans une minute.' } }))
      .toBe('Trop de tentatives de connexion. Réessayez dans une minute.')
  })

  it('answers wrong credentials for any other failure', () => {
    expect(describeLoginFailure({ statusCode: 401, data: { statusMessage: 'Email ou mot de passe incorrect' } }))
      .toBe('Email ou mot de passe incorrect.')
    expect(describeLoginFailure(new Error('network down'))).toBe('Email ou mot de passe incorrect.')
  })
})
