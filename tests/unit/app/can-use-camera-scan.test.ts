import { describe, expect, it } from 'vitest'
import { canUseCameraScan } from '../../../app/utils/can-use-camera-scan.ts'

describe('canUseCameraScan', () => {
  it('allows scanning on a coarse pointer device with a camera API', () => {
    expect(canUseCameraScan({ coarsePointer: true, viewportWidth: 1400, hasMediaDevices: true })).toBe(true)
  })

  it('allows scanning on a narrow viewport with a camera API', () => {
    expect(canUseCameraScan({ coarsePointer: false, viewportWidth: 959, hasMediaDevices: true })).toBe(true)
  })

  it('keeps the text search on a wide fine-pointer computer', () => {
    expect(canUseCameraScan({ coarsePointer: false, viewportWidth: 960, hasMediaDevices: true })).toBe(false)
  })

  it('keeps the text search when the browser exposes no camera API', () => {
    expect(canUseCameraScan({ coarsePointer: true, viewportWidth: 390, hasMediaDevices: false })).toBe(false)
  })
})
