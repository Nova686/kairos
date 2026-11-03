import { extractSearchWords } from '../../../shared/scan/extract-search-words.ts'

describe('extractSearchWords', () => {
  it('keeps the distinctive words of a box, accents included, and drops stop words', () => {
    const words = extractSearchWords('POKÉMON JCC Écarlate et Violet Évolutions Prismatiques Coffret Dresseur d\'Élite')

    expect(words).toEqual(expect.arrayContaining(['évolutions', 'prismatiques', 'coffret', 'dresseur']))
    expect(words).not.toContain('pokémon')
  })

  it('sorts longest first, ties by first occurrence', () => {
    expect(extractSearchWords('abc defg hij klmn')).toEqual(['defg', 'klmn', 'abc', 'hij'])
  })

  it('de-duplicates and ignores words under 3 letters and stop words', () => {
    expect(extractSearchWords('Pikachu pikachu le de the cartes Jeu 151 ex')).toEqual(['pikachu', '151'])
  })

  it('keeps at most 8 words', () => {
    const words = extractSearchWords('aaa bbb ccc ddd eee fff ggg hhh iii jjj')
    expect(words).toHaveLength(8)
    expect(words[0]).toBe('aaa')
  })

  it('returns nothing for noise', () => {
    expect(extractSearchWords('  ## -- !! ')).toEqual([])
  })
})
