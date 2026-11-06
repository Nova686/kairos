import { foldAccentsAndCase } from '../../../shared/text/fold-accents-and-case.ts'

describe('foldAccentsAndCase', () => {
  it('drops accents and case so French spellings compare equal', () => {
    expect(foldAccentsAndCase('Pokémon Écarlate ABÎMÉ')).toBe('pokemon ecarlate abime')
  })
})
