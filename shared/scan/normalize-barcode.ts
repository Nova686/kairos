const supportedLengths = [8, 12, 13, 14]

const hasValidCheckDigit = (digits: string): boolean => {
  const bodyDigits = digits.slice(0, -1).split('').reverse()
  const weightedSum = bodyDigits.reduce(
    (runningSum, digit, position) => runningSum + Number(digit) * (position % 2 === 0 ? 3 : 1),
    0,
  )
  return (10 - (weightedSum % 10)) % 10 === Number(digits.slice(-1))
}

const expandUpcEToUpcA = (upcE: string): string | null => {
  const numberSystem = upcE[0]
  if (numberSystem !== '0' && numberSystem !== '1') {
    return null
  }
  const [first, second, third, fourth, fifth, lastCodeDigit] = upcE.slice(1, 7)
  let upcABody: string
  if (lastCodeDigit === '0' || lastCodeDigit === '1' || lastCodeDigit === '2') {
    upcABody = `${first}${second}${lastCodeDigit}0000${third}${fourth}${fifth}`
  } else if (lastCodeDigit === '3') {
    upcABody = `${first}${second}${third}00000${fourth}${fifth}`
  } else if (lastCodeDigit === '4') {
    upcABody = `${first}${second}${third}${fourth}00000${fifth}`
  } else {
    return null
  }
  const upcA = `${numberSystem}${upcABody}${upcE[7]}`
  return hasValidCheckDigit(upcA) ? upcA : null
}

export const normalizeBarcode = (rawBarcode: string): string | null => {
  const digits = rawBarcode.trim()
  if (!/^\d+$/.test(digits) || !supportedLengths.includes(digits.length)) {
    return null
  }
  if (digits.length === 8 && !hasValidCheckDigit(digits)) {
    const upcA = expandUpcEToUpcA(digits)
    return upcA === null ? null : `0${upcA}`
  }
  if (!hasValidCheckDigit(digits)) {
    return null
  }
  return digits.length === 12 ? `0${digits}` : digits
}
