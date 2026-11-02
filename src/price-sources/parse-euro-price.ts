const euroAmountPattern = /(\d{1,3}(?:[ .]\d{3})+|\d+)(?:,(\d{1,2}))?/

export const parseEuroPrice = (displayedPrice: string): number | null => {
  const normalizedPrice = displayedPrice.replace(/[\u00A0\u202F]/g, ' ')
  if (!/€|\bEUR\b/.test(normalizedPrice)) {
    return null
  }
  const firstAmount = euroAmountPattern.exec(normalizedPrice)
  if (!firstAmount) {
    return null
  }
  const wholeEuros = Number(firstAmount[1]!.replace(/[ .]/g, ''))
  const cents = Number((firstAmount[2] ?? '0').padEnd(2, '0'))
  return wholeEuros * 100 + cents
}
