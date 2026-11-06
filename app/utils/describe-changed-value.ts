import { readBarcodeJournalValue } from '~~/shared/catalogue/barcode-journal-value.ts'

export const describeChangedValue = (changedValue: unknown): string => {
  if (changedValue === null || changedValue === undefined) {
    return '—'
  }
  const journaledBarcode = readBarcodeJournalValue(changedValue)
  if (journaledBarcode !== null) {
    return journaledBarcode
  }
  return typeof changedValue === 'object' ? JSON.stringify(changedValue) : String(changedValue)
}
