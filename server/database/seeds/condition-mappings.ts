import type { ConditionMappingEntry, TitleConditionRuleEntry } from '../../../shared/prices/resolve-kairos-condition.ts'
import type { KairosDatabase } from '../open-database.ts'
import { conditionMappings, titleConditionRules } from '../schema/index.ts'

const generalCategories = ['toy', 'makeup', 'other']

const ebayGeneralMappings = [
  { sourceCondition: 'Neuf', kairosCondition: 'new-with-tags' },
  { sourceCondition: 'Neuf : autre (voir détails)', kairosCondition: 'new-without-tags' },
  { sourceCondition: 'Occasion', kairosCondition: 'good' },
  { sourceCondition: 'Reconditionné', kairosCondition: 'very-good' },
] as const

export const conditionMappingSeeds: ConditionMappingEntry[] = [
  { category: 'pokemon-sealed', source: 'ebay', sourceCondition: 'Neuf', kairosCondition: 'sealed-new' },
  { category: 'pokemon-sealed', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'opened-complete' },
  { category: 'pokemon-sealed', source: 'ebay', sourceCondition: 'Neuf : autre (voir détails)', kairosCondition: 'sealed-damaged-box' },
  ...generalCategories.flatMap(category =>
    ebayGeneralMappings.map(mapping => ({ category, source: 'ebay', ...mapping }))),
]

export const titleConditionRuleSeeds: Omit<TitleConditionRuleEntry, 'id'>[] = [
  { category: 'pokemon-sealed', keywords: ['vide', 'empty', 'sans cartes', 'incompl*'], kairosCondition: 'opened-incomplete', priority: 30 },
  { category: 'pokemon-sealed', keywords: ['ouvert', 'opened', 'open'], kairosCondition: 'opened-complete', priority: 20 },
  { category: 'pokemon-sealed', keywords: ['abîm*', 'abim*', 'cabossé*', 'dented', 'damaged', 'enfonc*'], kairosCondition: 'sealed-damaged-box', priority: 10 },
]

export const seedConditionMappings = async (database: KairosDatabase): Promise<void> => {
  await database.insert(conditionMappings).values(conditionMappingSeeds).onConflictDoNothing()
  const [existingRule] = await database.select({ id: titleConditionRules.id }).from(titleConditionRules).limit(1)
  if (!existingRule) {
    await database.insert(titleConditionRules).values(titleConditionRuleSeeds)
  }
}
