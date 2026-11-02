const parisTimeZone = 'Europe/Paris'

const parisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: parisTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const parisWallClockAsUtcMilliseconds = (moment: Date): number => {
  const parts = Object.fromEntries(parisFormatter.formatToParts(moment).map(part => [part.type, part.value]))
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
}

export const startOfParisDay = (moment: Date): Date => {
  const wallClockMilliseconds = parisWallClockAsUtcMilliseconds(moment)
  const wallClockDay = new Date(wallClockMilliseconds)
  const midnightWallClockMilliseconds = Date.UTC(
    wallClockDay.getUTCFullYear(),
    wallClockDay.getUTCMonth(),
    wallClockDay.getUTCDate(),
  )
  const offsetMilliseconds = wallClockMilliseconds - Math.floor(moment.getTime() / 1000) * 1000
  const candidate = new Date(midnightWallClockMilliseconds - offsetMilliseconds)
  const candidateOffset = parisWallClockAsUtcMilliseconds(candidate) - candidate.getTime()
  return new Date(midnightWallClockMilliseconds - candidateOffset)
}
