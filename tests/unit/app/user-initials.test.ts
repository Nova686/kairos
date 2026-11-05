import { describe, expect, it } from 'vitest'
import { describeUserInitials } from '../../../app/utils/user-initials.ts'

describe('describeUserInitials', () => {
  it('takes the first letter of the first two words, upper-cased', () => {
    expect(describeUserInitials('noé zimmermann')).toBe('NZ')
  })

  it('keeps a single letter for a one-word name', () => {
    expect(describeUserInitials('Admin')).toBe('A')
  })

  it('ignores extra spaces and words beyond the second', () => {
    expect(describeUserInitials('  Jean   Paul  Sartre ')).toBe('JP')
  })

  it('falls back to a question mark for an empty name', () => {
    expect(describeUserInitials('   ')).toBe('?')
  })
})
