const minimumValuesForOutlierRemoval = 4
const interquartileRangeMultiplier = 1.5

const quantileOfSorted = (sortedValues: number[], probability: number): number => {
  const position = (sortedValues.length - 1) * probability
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lowerValue = sortedValues[lowerIndex]!
  const upperValue = sortedValues[upperIndex]!
  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex)
}

export const removeOutliers = (pricesCents: number[]): number[] => {
  const sorted = [...pricesCents].sort((left, right) => left - right)
  if (sorted.length < minimumValuesForOutlierRemoval) return pricesCents
  const firstQuartile = quantileOfSorted(sorted, 0.25)
  const thirdQuartile = quantileOfSorted(sorted, 0.75)
  const fenceDistance = (thirdQuartile - firstQuartile) * interquartileRangeMultiplier
  return sorted.filter(price => price >= firstQuartile - fenceDistance && price <= thirdQuartile + fenceDistance)
}
