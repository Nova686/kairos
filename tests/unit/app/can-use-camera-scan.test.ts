import { describe, expect, it } from 'vitest'
import { canUseCameraScan } from '../../../app/utils/can-use-camera-scan.ts'

describe('canUseCameraScan', () => {
  it('allows scanning on a coarse pointer device', () => {
    expect(canUseCameraScan({ coarsePointer: true, viewportWidth: 1400 })).toBe(true)
  })

  it('allows scanning on a narrow viewport', () => {
    expect(canUseCameraScan({ coarsePointer: false, viewportWidth: 959 })).toBe(true)
  })

  it('keeps the text search on a wide fine-pointer computer', () => {
    expect(canUseCameraScan({ coarsePointer: false, viewportWidth: 960 })).toBe(false)
  })
})
