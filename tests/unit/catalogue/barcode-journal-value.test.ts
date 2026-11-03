import { readBarcodeJournalValue, toBarcodeJournalValue } from '../../../shared/catalogue/barcode-journal-value.ts'

describe('barcode journal value', () => {
  it('round-trips digits-only and leading-zero barcodes as strings', () => {
    expect(readBarcodeJournalValue(toBarcodeJournalValue('3665361000001'))).toBe('3665361000001')
    expect(readBarcodeJournalValue(toBarcodeJournalValue('0820650853715'))).toBe('0820650853715')
  })

  it('reads nothing from other journal values', () => {
    expect(readBarcodeJournalValue(null)).toBeNull()
    expect(readBarcodeJournalValue('Display')).toBeNull()
    expect(readBarcodeJournalValue({ barcode: 3665361000001 })).toBeNull()
  })
})
