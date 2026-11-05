import {
  bottomBarEntries,
  isNavigationEntryActive,
  mainNavigationEntries,
  moreMenuEntries,
} from '../../../app/utils/main-navigation-entries.ts'

describe('main navigation entries', () => {
  it('lists the nine entries of the side drawer', () => {
    expect(mainNavigationEntries.map(entry => entry.label)).toEqual([
      'Tableau de bord', 'Stock', 'Ajouter', 'Ventes', 'Livraisons', 'Dettes', 'Lieux', 'Personnes', 'Réglages',
    ])
  })

  it('shows Accueil, Stock, Ajouter and Ventes in the bottom bar', () => {
    expect(bottomBarEntries.map(entry => entry.shortLabel)).toEqual(['Accueil', 'Stock', 'Ajouter', 'Ventes'])
  })

  it('puts the remaining entries under Plus', () => {
    expect(moreMenuEntries.map(entry => entry.label)).toEqual(['Livraisons', 'Dettes', 'Lieux', 'Personnes', 'Réglages'])
  })

  it('keeps every entry either in the bottom bar or under Plus', () => {
    expect([...bottomBarEntries, ...moreMenuEntries]).toHaveLength(mainNavigationEntries.length)
  })
})

describe('isNavigationEntryActive', () => {
  it('matches the dashboard on the root path only', () => {
    expect(isNavigationEntryActive('/', '/')).toBe(true)
    expect(isNavigationEntryActive('/', '/stock')).toBe(false)
  })

  it('matches nested paths of an entry', () => {
    expect(isNavigationEntryActive('/stock', '/stock/12')).toBe(true)
    expect(isNavigationEntryActive('/ventes', '/stock/12')).toBe(false)
  })

  it('does not match a path that only shares a prefix', () => {
    expect(isNavigationEntryActive('/stock', '/stockage')).toBe(false)
  })

  it('keeps Stock active on a product page', () => {
    expect(isNavigationEntryActive('/stock', '/produits/7')).toBe(true)
  })

  it('keeps Ajouter active on its sub-pages', () => {
    expect(isNavigationEntryActive('/ajouter', '/ajouter/achat')).toBe(true)
  })
})
