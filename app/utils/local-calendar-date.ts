const twoDigits = (value: number): string => String(value).padStart(2, '0')

export const toLocalCalendarDate = (moment: Date): string =>
  `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())}`

export const todayAsLocalCalendarDate = (): string => toLocalCalendarDate(new Date())
