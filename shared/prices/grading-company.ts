const knownGradingCompanies = ['PSA', 'PCA', 'CGC', 'BGS', 'CCC', 'Collect Grade']

const comparisonKeyOf = (companyName: string): string => companyName.replace(/\s+/g, '').toLowerCase()

const knownCompanyByKey = new Map(knownGradingCompanies.map(companyName => [comparisonKeyOf(companyName), companyName]))

export const canonicalCompanyName = (companyName: string): string =>
  knownCompanyByKey.get(comparisonKeyOf(companyName)) ?? companyName.trim().replace(/\s+/g, ' ')

export const isSameGradingCompany = (leftCompanyName: string, rightCompanyName: string): boolean =>
  comparisonKeyOf(canonicalCompanyName(leftCompanyName)) === comparisonKeyOf(canonicalCompanyName(rightCompanyName))
