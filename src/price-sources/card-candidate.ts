export interface CardCandidate {
  source: 'tcgdex' | 'pokemontcg'
  sourceCardId: string
  name: string
  setName: string | null
  imageUrl: string | null
}
