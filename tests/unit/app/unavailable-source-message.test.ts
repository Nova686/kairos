import { describe, expect, it } from 'vitest'
import { describeRefreshOutcome, describeUnavailableSource } from '../../../app/utils/unavailable-source-message.ts'

describe('describeUnavailableSource', () => {
  it('names a source whose key is missing', () => {
    expect(describeUnavailableSource({ source: 'ebay', kind: 'missing-key', reason: 'EBAY_CLIENT_ID is not set' }))
      .toBe('eBay indisponible : clé manquante')
  })

  it('names a source that blocked the request', () => {
    expect(describeUnavailableSource({ source: 'cardmarket', kind: 'blocked', reason: 'HTTP 403' }))
      .toBe('Cardmarket indisponible : bloqué')
  })

  it('names a source that failed', () => {
    expect(describeUnavailableSource({ source: 'tcgdex', kind: 'error', reason: 'error: HTTP 500' }))
      .toBe('TCGdex indisponible : erreur')
  })

  it('keeps an unknown source name', () => {
    expect(describeUnavailableSource({ source: 'mystery', kind: 'error', reason: 'error: boom' }))
      .toBe('mystery indisponible : erreur')
  })
})

describe('describeRefreshOutcome', () => {
  it('confirms a refresh without unavailable source', () => {
    expect(describeRefreshOutcome([])).toBe('Prix relevés.')
  })

  it('lists every unavailable source', () => {
    expect(describeRefreshOutcome([
      { source: 'ebay', kind: 'missing-key', reason: 'EBAY_CLIENT_ID is not set' },
      { source: 'pokemontcg', kind: 'error', reason: 'error: timeout' },
    ])).toBe('Prix relevés. eBay indisponible : clé manquante ; Pokémon TCG indisponible : erreur.')
  })
})
