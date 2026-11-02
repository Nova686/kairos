const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const typedEuroPattern = /^(\d+)(?:[.,](\d{1,2}))?$/

export const formatEuros = (cents: number): string => euroFormatter.format(cents / 100)

export const parseEuroInput = (typedAmount: string): number | null => {
  const compactAmount = typedAmount.replace(/[\s€]/gu, '')
  const amountMatch = typedEuroPattern.exec(compactAmount)
  if (amountMatch === null) {
    return null
  }
  const wholeEuros = Number(amountMatch[1])
  const fractionCents = Number((amountMatch[2] ?? '').padEnd(2, '0'))
  return wholeEuros * 100 + fractionCents
}
