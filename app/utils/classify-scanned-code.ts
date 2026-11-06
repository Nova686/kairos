import { normalizeBarcode } from '~~/shared/scan/normalize-barcode.ts'

export type ClassifiedScanCode =
  | { kind: 'barcode', barcode: string }
  | { kind: 'psa', certificateNumber: string }
  | { kind: 'invalid' }

export const classifyScannedCode = (rawCode: string, isPsaMode: boolean): ClassifiedScanCode => {
  const trimmedCode = rawCode.trim()
  if (isPsaMode) {
    return /^\d{7,10}$/.test(trimmedCode) ? { kind: 'psa', certificateNumber: trimmedCode } : { kind: 'invalid' }
  }
  const barcode = normalizeBarcode(trimmedCode)
  return barcode === null ? { kind: 'invalid' } : { kind: 'barcode', barcode }
}
