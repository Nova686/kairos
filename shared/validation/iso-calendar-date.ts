import { z } from 'zod'

const isoCalendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

const isExistingCalendarDate = (calendarDate: string): boolean => {
  const matchedParts = isoCalendarDatePattern.exec(calendarDate)
  if (matchedParts === null) {
    return false
  }
  const year = Number(matchedParts[1])
  const month = Number(matchedParts[2])
  const day = Number(matchedParts[3])
  const reconstructedDate = new Date(Date.UTC(year, month - 1, day))
  return reconstructedDate.getUTCFullYear() === year
    && reconstructedDate.getUTCMonth() === month - 1
    && reconstructedDate.getUTCDate() === day
}

export const isoCalendarDateSchema = z.string().refine(isExistingCalendarDate, { message: 'Date calendaire invalide' })
