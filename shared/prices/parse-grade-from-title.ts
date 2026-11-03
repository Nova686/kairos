import { canonicalCompanyName } from './grading-company.ts'

const gradeInTitlePattern = /\b(PSA|PCA|CGC|BGS|Collect\s*Grade|CCC)\s*(10|[1-9](?:\.5)?)(?!\d)/i

export interface GradeFromTitle {
  gradingCompany: string
  grade: string
}

export const parseGradeFromTitle = (title: string): GradeFromTitle | null => {
  const gradeMatch = gradeInTitlePattern.exec(title)
  if (!gradeMatch) {
    return null
  }
  return { gradingCompany: canonicalCompanyName(gradeMatch[1]!), grade: gradeMatch[2]! }
}
