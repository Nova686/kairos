export interface ProductIdentification {
  source: 'psa' | 'openbeautyfacts' | 'upcitemdb'
  name: string
  brand: string | null
  imageUrl: string | null
  barcode: string | null
  gradingCompany: string | null
  grade: string | null
  certificateNumber: string | null
}
