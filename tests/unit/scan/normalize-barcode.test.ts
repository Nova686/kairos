import { normalizeBarcode } from '../../../shared/scan/normalize-barcode.ts'

describe('normalizeBarcode', () => {
  it('pads a UPC-A to EAN-13 and keeps an EAN-13', () => {
    expect(normalizeBarcode('042100005264')).toBe('0042100005264')
    expect(normalizeBarcode('0042100005264')).toBe('0042100005264')
  })

  it('keeps a valid EAN-8', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
  })

  it('expands a UPC-E to the EAN-13 of its UPC-A', () => {
    expect(normalizeBarcode('04252614')).toBe('0042100005264')
  })

  it('expands each UPC-E ending rule that differs from EAN-8', () => {
    expect(normalizeBarcode('01234505')).toBe('0012000003455')
    expect(normalizeBarcode('01234531')).toBe('0012300000451')
    expect(normalizeBarcode('01234543')).toBe('0012340000053')
  })

  it('refuses an 8-digit code valid as neither EAN-8 nor UPC-E', () => {
    expect(normalizeBarcode('04252615')).toBeNull()
    expect(normalizeBarcode('14252614')).toBeNull()
  })

  it('refuses non-numeric or badly checked codes', () => {
    expect(normalizeBarcode('abc')).toBeNull()
    expect(normalizeBarcode('3665361000001')).toBeNull()
  })
})
