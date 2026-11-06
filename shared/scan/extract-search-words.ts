const stopWords = new Set([
  'pokemon',
  'pokémon',
  'the',
  'les',
  'des',
  'jeu',
  'cartes',
  'card',
  'game',
  'company',
  'nintendo',
  'ans',
  'age',
])

const minimumWordLength = 3
const maximumSearchWords = 8

export const splitIntoWords = (text: string): string[] =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

export const extractSearchWords = (ocrText: string): string[] => {
  const distinctWords = [...new Set(splitIntoWords(ocrText))]
    .filter(word => word.length >= minimumWordLength && !stopWords.has(word))
  return distinctWords
    .map((word, firstOccurrenceIndex) => ({ word, firstOccurrenceIndex }))
    .sort((left, right) => right.word.length - left.word.length || left.firstOccurrenceIndex - right.firstOccurrenceIndex)
    .slice(0, maximumSearchWords)
    .map(({ word }) => word)
}
