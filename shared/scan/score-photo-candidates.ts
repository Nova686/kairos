import { splitIntoWords } from './extract-search-words.ts'

export type PhotoCandidateSignal = {
  productId: string | null
  candidateKey: string
  label: string
  visualSimilarity: number | null
  candidateName: string
}

export type PhotoCandidateScore = { candidateKey: string; score: number }

const minimumWordLength = 3
const visualWeightWithText = 0.6
const textWeightWithVisual = 0.4
const textOnlyWeight = 0.7
const autoPickMinimumScore = 0.85
const autoPickMinimumLead = 0.1
const leadComparisonTolerance = 1e-9
export const minimumVisualSimilarityForCandidate = 0.7

const stripAccents = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '')

const comparableWords = (text: string): string[] =>
  splitIntoWords(stripAccents(text)).filter(word => word.length >= minimumWordLength)

const computeTextScore = (candidateName: string, searchWords: string[]): number => {
  const candidateWords = comparableWords(candidateName)
  if (candidateWords.length === 0) {
    return 0
  }
  const foundSearchWords = new Set(searchWords.map(stripAccents))
  const matchedCount = candidateWords.filter(word => foundSearchWords.has(word)).length
  return matchedCount / candidateWords.length
}

export const scorePhotoCandidates = (
  signals: PhotoCandidateSignal[],
  searchWords: string[],
): PhotoCandidateScore[] =>
  signals
    .map((signal) => {
      const textScore = computeTextScore(signal.candidateName, searchWords)
      const score = signal.visualSimilarity === null
        ? textOnlyWeight * textScore
        : visualWeightWithText * signal.visualSimilarity + textWeightWithVisual * textScore
      return { candidateKey: signal.candidateKey, score }
    })
    .sort((left, right) => right.score - left.score)

export const shouldAutoPick = (scores: PhotoCandidateScore[]): boolean => {
  const [top, second] = scores
  if (!top || top.score < autoPickMinimumScore) {
    return false
  }
  return !second || top.score - second.score >= autoPickMinimumLead - leadComparisonTolerance
}
