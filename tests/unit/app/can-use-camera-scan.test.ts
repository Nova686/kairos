import { describe, expect, it } from 'vitest'
import { canUseCameraScan, guessCameraScanFromRequest } from '../../../app/utils/can-use-camera-scan.ts'

const iPhoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const androidPhoneUserAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
const firefoxMobileUserAgent = 'Mozilla/5.0 (Mobile; rv:144.0) Gecko/144.0 Firefox/144.0'
const desktopChromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const desktopSafariUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'

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

describe('guessCameraScanFromRequest', () => {
  it('guesses a phone from the mobile client hint', () => {
    expect(guessCameraScanFromRequest({ mobileClientHint: '?1', userAgent: desktopChromeUserAgent })).toBe(true)
  })

  it('guesses a phone from an iPhone, Android or mobile user agent', () => {
    expect(guessCameraScanFromRequest({ mobileClientHint: undefined, userAgent: iPhoneUserAgent })).toBe(true)
    expect(guessCameraScanFromRequest({ mobileClientHint: undefined, userAgent: androidPhoneUserAgent })).toBe(true)
    expect(guessCameraScanFromRequest({ mobileClientHint: undefined, userAgent: firefoxMobileUserAgent })).toBe(true)
  })

  it('keeps computers on the text search', () => {
    expect(guessCameraScanFromRequest({ mobileClientHint: '?0', userAgent: desktopChromeUserAgent })).toBe(false)
    expect(guessCameraScanFromRequest({ mobileClientHint: undefined, userAgent: desktopSafariUserAgent })).toBe(false)
  })

  it('keeps the text search when the request says nothing about the device', () => {
    expect(guessCameraScanFromRequest({ mobileClientHint: undefined, userAgent: undefined })).toBe(false)
    expect(guessCameraScanFromRequest({ mobileClientHint: undefined, userAgent: 'node' })).toBe(false)
  })
})
