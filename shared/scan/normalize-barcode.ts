const supportedLengths = [8, 12, 13, 14]

const hasValidCheckDigit = (digits: string): boolean => {
  const bodyDigits = digits.slice(0, -1).split('').reverse()
  const weightedSum = bodyDigits.reduce(
    (runningSum, digit, position) => runningSum + Number(digit) * (position % 2 === 0 ? 3 : 1),
    0,
  )
  return (10 - (weightedSum % 10)) % 10 === Number(digits.slice(-1))
}

export const normalizeBarcode = (rawBarcode: string): string | null => {
  const digits = rawBarcode.trim()
  if (!/^\d+$/.test(digits) || !supportedLengths.includes(digits.length) || !hasValidCheckDigit(digits)) {
    return null
  }
  return digits.length === 12 ? `0${digits}` : digits
}
