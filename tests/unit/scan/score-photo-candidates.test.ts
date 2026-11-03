import { scorePhotoCandidates, shouldAutoPick } from '../../../shared/scan/score-photo-candidates.ts'
import type { PhotoCandidateSignal } from '../../../shared/scan/score-photo-candidates.ts'

const signal = (overrides: Partial<PhotoCandidateSignal>): PhotoCandidateSignal => ({
  productId: null,
  candidateKey: 'key',
  label: 'label',
  visualSimilarity: null,
  candidateName: 'Coffret Dresseur Élite Évolutions Prismatiques',
  ...overrides,
})

describe('scorePhotoCandidates', () => {
  it('merges visual similarity and text score', () => {
    const scores = scorePhotoCandidates(
      [
        signal({ candidateKey: 'a', visualSimilarity: 0.92, candidateName: 'Évolutions Prismatiques' }),
        signal({ candidateKey: 'b', visualSimilarity: 0.7, candidateName: 'Évolutions Paldea' }),
      ],
      ['evolutions', 'prismatiques'],
    )

    expect(scores.map(score => score.candidateKey)).toEqual(['a', 'b'])
    expect(scores[0]!.score).toBeCloseTo(0.952)
    expect(scores[1]!.score).toBeCloseTo(0.62)
  })

  it('uses text only, discounted, without visual similarity', () => {
    const [score] = scorePhotoCandidates(
      [signal({ candidateKey: 'a', candidateName: 'Coffret Dresseur' })],
      ['coffret', 'dresseur'],
    )
    expect(score!.score).toBeCloseTo(0.7)
  })

  it('compares accent-insensitively and ignores short candidate words', () => {
    const [score] = scorePhotoCandidates(
      [signal({ candidateKey: 'a', candidateName: 'Élite de Dresseur' })],
      ['élite', 'dresseur'],
    )
    expect(score!.score).toBeCloseTo(0.7)
  })

  it('scores zero text for a name without eligible words', () => {
    const [score] = scorePhotoCandidates([signal({ candidateName: 'de la' })], ['coffret'])
    expect(score!.score).toBe(0)
  })

  it('sorts descending', () => {
    const scores = scorePhotoCandidates(
      [signal({ candidateKey: 'low', visualSimilarity: 0.1 }), signal({ candidateKey: 'high', visualSimilarity: 0.9 })],
      [],
    )
    expect(scores.map(score => score.candidateKey)).toEqual(['high', 'low'])
  })
})

describe('shouldAutoPick', () => {
  it('picks a clear winner', () => {
    expect(shouldAutoPick([{ candidateKey: 'a', score: 0.952 }, { candidateKey: 'b', score: 0.62 }])).toBe(true)
  })

  it('refuses a narrow lead', () => {
    expect(shouldAutoPick([{ candidateKey: 'a', score: 0.86 }, { candidateKey: 'b', score: 0.8 }])).toBe(false)
  })

  it('accepts a lone candidate at the threshold only', () => {
    expect(shouldAutoPick([{ candidateKey: 'a', score: 0.85 }])).toBe(true)
    expect(shouldAutoPick([{ candidateKey: 'a', score: 0.84 }])).toBe(false)
  })

  it('refuses an empty list', () => {
    expect(shouldAutoPick([])).toBe(false)
  })
})
