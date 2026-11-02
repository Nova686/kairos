const parisDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const parisCalendarDateOfMoment = (moment: Date): string => parisDateFormatter.format(moment)

export const todayAsParisCalendarDate = (): string => parisCalendarDateOfMoment(new Date())
