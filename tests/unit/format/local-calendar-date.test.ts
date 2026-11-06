import { toLocalCalendarDate } from '../../../app/utils/local-calendar-date.ts'

describe('toLocalCalendarDate', () => {
  it('uses the local calendar day shortly after local midnight', () => {
    expect(toLocalCalendarDate(new Date(2026, 10, 2, 0, 30))).toBe('2026-11-02')
  })

  it('uses the local calendar day shortly before local midnight', () => {
    expect(toLocalCalendarDate(new Date(2026, 0, 9, 23, 45))).toBe('2026-01-09')
  })
})
