import { describe, expect, it } from 'vitest'
import { describeChangedValue } from '../../../app/utils/describe-changed-value.ts'

describe('describeChangedValue', () => {
  it('shows a dash for a missing value', () => {
    expect(describeChangedValue(null)).toBe('—')
    expect(describeChangedValue(undefined)).toBe('—')
  })

  it('shows a journaled barcode as the bare code', () => {
    expect(describeChangedValue({ barcode: '3665361000001' })).toBe('3665361000001')
  })

  it('shows text as is and other objects as JSON', () => {
    expect(describeChangedValue('Display EV1')).toBe('Display EV1')
    expect(describeChangedValue(['abime', 'raye'])).toBe('["abime","raye"]')
  })
})
