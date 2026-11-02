export const allocateCents = (totalCents: number, weights: number[]): number[] => {
  if (weights.length === 0) {
    throw new RangeError('allocateCents needs at least one weight')
  }
  if (totalCents < 0) {
    throw new RangeError('allocateCents needs a non-negative total')
  }
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const effectiveWeights = weightSum === 0 ? weights.map(() => 1) : weights
  const effectiveSum = weightSum === 0 ? weights.length : weightSum

  const shares = effectiveWeights.map(weight => Math.floor((totalCents * weight) / effectiveSum))
  const remainders = effectiveWeights.map((weight, index) => ({
    index,
    remainder: (totalCents * weight) % effectiveSum,
  }))
  remainders.sort((first, second) => second.remainder - first.remainder || first.index - second.index)

  const leftoverCents = totalCents - shares.reduce((sum, share) => sum + share, 0)
  for (let position = 0; position < leftoverCents; position++) {
    shares[remainders[position]!.index]!++
  }
  return shares
}
