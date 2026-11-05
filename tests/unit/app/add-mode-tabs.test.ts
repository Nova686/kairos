import { describe, expect, it } from 'vitest'
import { buildAddModeTabs, resolveDisplayedAddTab } from '../../../app/utils/add-mode-tabs.ts'

describe('buildAddModeTabs', () => {
  it('offers every tab on a phone with photo recognition', () => {
    expect(buildAddModeTabs({ cameraScanAvailable: true, photoRecognitionAvailable: true })).toEqual(['code-barres', 'photo', 'texte'])
  })

  it('drops the photo tab when recognition is off', () => {
    expect(buildAddModeTabs({ cameraScanAvailable: true, photoRecognitionAvailable: false })).toEqual(['code-barres', 'texte'])
  })

  it('offers only the text search on a computer', () => {
    expect(buildAddModeTabs({ cameraScanAvailable: false, photoRecognitionAvailable: true })).toEqual(['texte'])
    expect(buildAddModeTabs({ cameraScanAvailable: false, photoRecognitionAvailable: false })).toEqual(['texte'])
  })
})

describe('resolveDisplayedAddTab', () => {
  it('keeps an available requested tab', () => {
    expect(resolveDisplayedAddTab('photo', ['code-barres', 'photo', 'texte'])).toBe('photo')
    expect(resolveDisplayedAddTab('code-barres', ['code-barres', 'texte'])).toBe('code-barres')
  })

  it('falls back to the text search when the requested tab is unavailable', () => {
    expect(resolveDisplayedAddTab('photo', ['code-barres', 'texte'])).toBe('texte')
    expect(resolveDisplayedAddTab('code-barres', ['texte'])).toBe('texte')
    expect(resolveDisplayedAddTab('photo', ['texte'])).toBe('texte')
  })
})
