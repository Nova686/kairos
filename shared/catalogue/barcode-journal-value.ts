export interface BarcodeJournalValue {
  barcode: string
}

export const toBarcodeJournalValue = (barcode: string): BarcodeJournalValue => ({ barcode })

export const readBarcodeJournalValue = (journaledValue: unknown): string | null => {
  if (typeof journaledValue !== 'object' || journaledValue === null || !('barcode' in journaledValue)) {
    return null
  }
  return typeof journaledValue.barcode === 'string' ? journaledValue.barcode : null
}
