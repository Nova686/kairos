import { classifyScannedCode } from '../../../app/utils/classify-scanned-code.ts'

describe('classifyScannedCode', () => {
  it('routes a valid barcode to the barcode lookup and normalizes UPC-A', () => {
    expect(classifyScannedCode('3017620422003', false)).toEqual({ kind: 'barcode', barcode: '3017620422003' })
    expect(classifyScannedCode(' 036000291452 ', false)).toEqual({ kind: 'barcode', barcode: '0036000291452' })
  })

  it('rejects a barcode with a wrong check digit or non digits', () => {
    expect(classifyScannedCode('3017620422004', false)).toEqual({ kind: 'invalid' })
    expect(classifyScannedCode('abc', false)).toEqual({ kind: 'invalid' })
  })

  it('routes 7 to 10 digit codes to PSA in PSA mode, even an 8-digit one', () => {
    expect(classifyScannedCode('12345678', true)).toEqual({ kind: 'psa', certificateNumber: '12345678' })
    expect(classifyScannedCode('1234567', true)).toEqual({ kind: 'psa', certificateNumber: '1234567' })
    expect(classifyScannedCode('1234567890', true)).toEqual({ kind: 'psa', certificateNumber: '1234567890' })
  })

  it('rejects out-of-range codes in PSA mode', () => {
    expect(classifyScannedCode('123456', true)).toEqual({ kind: 'invalid' })
    expect(classifyScannedCode('3017620422003', true)).toEqual({ kind: 'invalid' })
  })
})
