import type { ProductCategory } from './product-category.ts'

const conditionLabels = {
  'sealed-new': 'neuf scellé',
  'sealed-damaged-box': 'neuf boîte abîmée',
  'opened-complete': 'ouvert complet',
  'opened-incomplete': 'ouvert incomplet',
  'new-with-tags': 'neuf avec étiquette / emballage',
  'new-without-tags': 'neuf sans étiquette',
  'very-good': 'très bon état',
  'good': 'bon état',
  'satisfactory': 'état satisfaisant',
  'graded': 'gradée',
} as const

export type ConditionCode = keyof typeof conditionLabels

export const conditionCodes = Object.keys(conditionLabels) as [ConditionCode, ...ConditionCode[]]

const sealedConditionCodes: ConditionCode[] = ['sealed-new', 'sealed-damaged-box', 'opened-complete', 'opened-incomplete']
const generalConditionCodes: ConditionCode[] = ['new-with-tags', 'new-without-tags', 'very-good', 'good', 'satisfactory']
const gradedConditionCodes: ConditionCode[] = ['graded']

const conditionCodesByCategory: Record<ProductCategory, ConditionCode[]> = {
  'pokemon-sealed': sealedConditionCodes,
  'graded-card': gradedConditionCodes,
  'toy': generalConditionCodes,
  'makeup': generalConditionCodes,
  'other': generalConditionCodes,
}

export const conditionCodesFor = (category: ProductCategory): ConditionCode[] => [...conditionCodesByCategory[category]]

export const conditionLabel = (code: ConditionCode): string => conditionLabels[code]

export const isConditionAllowed = (category: ProductCategory, code: ConditionCode): boolean =>
  conditionCodesByCategory[category].includes(code)
