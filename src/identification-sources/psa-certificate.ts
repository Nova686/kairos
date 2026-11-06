import { readRequiredSetting, requestSourceJson } from '../source-http/request-source-json.ts'
import type { FetchFunction } from '../source-http/request-source-json.ts'
import type { ProductIdentification } from './identification-types.ts'

interface PsaCertificateLookup {
  PSACert?: {
    CertNumber: string
    Year?: string
    Brand?: string
    Subject?: string
    CardNumber?: string
    CardGrade?: string
  }
}

const extractNumericGrade = (cardGrade: string | undefined): string | null =>
  cardGrade?.match(/(\d+(?:\.\d+)?)\s*$/)?.[1] ?? null

export const lookupPsaCertificate = async (
  certificateNumber: string,
  fetchFunction?: FetchFunction,
): Promise<ProductIdentification | null> => {
  const psaToken = readRequiredSetting('psa', 'PSA_API_TOKEN')
  const lookup = await requestSourceJson<PsaCertificateLookup>(
    'psa',
    `https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(certificateNumber)}`,
    { headers: { authorization: `bearer ${psaToken}` } },
    fetchFunction,
  )
  const certificate = lookup?.PSACert
  if (!certificate) {
    return null
  }
  const cardNumberLabel = certificate.CardNumber ? `#${certificate.CardNumber}` : null
  return {
    source: 'psa',
    name: [certificate.Year, certificate.Brand, certificate.Subject, cardNumberLabel].filter(Boolean).join(' '),
    brand: certificate.Brand ?? null,
    imageUrl: null,
    barcode: null,
    gradingCompany: 'PSA',
    grade: extractNumericGrade(certificate.CardGrade),
    certificateNumber: certificate.CertNumber,
  }
}
