const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

const typedEuroPattern = /^(\d+)(?:[.,](\d{1,2}))?$/

const signedPercentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

export const formatEuros = (cents: number): string => euroFormatter.format(cents / 100)

export const formatSignedEuros = (cents: number): string => cents > 0 ? `+${formatEuros(cents)}` : formatEuros(cents)

export const formatSignedPercent = (ratio: number): string => signedPercentFormatter.format(ratio)

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
