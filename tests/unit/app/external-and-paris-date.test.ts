import { describe, expect, it } from 'vitest'
import { safeExternalHref } from '../../../app/utils/safe-external-href.ts'
import { parisCalendarDateOfMoment } from '../../../app/utils/paris-calendar-date.ts'

describe('safeExternalHref', () => {
  it('keeps http and https links', () => {
    expect(safeExternalHref('https://www.ebay.fr/itm/1?x=2')).toBe('https://www.ebay.fr/itm/1?x=2')
    expect(safeExternalHref('http://example.org/a')).toBe('http://example.org/a')
  })

  it('refuses script, data, file, relative and malformed links', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBeUndefined()
    expect(safeExternalHref(' JavaScript:alert(1)')).toBeUndefined()
    expect(safeExternalHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeExternalHref('file:///etc/passwd')).toBeUndefined()
    expect(safeExternalHref('/relative/path')).toBeUndefined()
    expect(safeExternalHref('not a url')).toBeUndefined()
    expect(safeExternalHref(null)).toBeUndefined()
  })
})

describe('parisCalendarDateOfMoment', () => {
  it('uses the Paris calendar day, not the UTC one', () => {
    expect(parisCalendarDateOfMoment(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02')
    expect(parisCalendarDateOfMoment(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02')
    expect(parisCalendarDateOfMoment(new Date('2026-11-01T22:30:00Z'))).toBe('2026-11-01')
  })
})
