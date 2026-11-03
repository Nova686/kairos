import { and, asc, desc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { isConditionAllowed, type ConditionCode } from '../../../shared/catalogue/condition-scale.ts'
import { isProductCategory } from '../../../shared/catalogue/product-category.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import { conditionMappings, titleConditionRules } from '../../database/schema/index.ts'
import { appendCatalogueChanges } from '../catalogue/catalogue-journal.ts'

export type ConditionMapping = typeof conditionMappings.$inferSelect
export type TitleConditionRule = typeof titleConditionRules.$inferSelect

export const conditionMappingSubject = 'condition-mapping'
export const titleRuleSubject = 'title-rule'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class ConditionMappingConditionNotAllowedError extends Error {
  constructor() {
    super('Condition is not part of the category scale')
    this.name = 'ConditionMappingConditionNotAllowedError'
  }
}

export class DuplicateTitleRuleError extends Error {
  constructor() {
    super('Une règle avec ces mots-clés existe déjà pour cette catégorie')
    this.name = 'DuplicateTitleRuleError'
  }
}

export interface ConditionMappingKey {
  category: string
  source: string
  sourceCondition: string
}

export interface ConditionMappingDraft extends ConditionMappingKey {
  kairosCondition: ConditionCode
}

export interface TitleRuleDraft {
  category: string
  keywords: string[]
  kairosCondition: ConditionCode
  priority: number
}

const mappingFieldName = (key: ConditionMappingKey): string => `${key.category}/${key.source}/${key.sourceCondition}`

const mappingKeyCondition = (key: ConditionMappingKey) => and(
  eq(conditionMappings.category, key.category),
  eq(conditionMappings.source, key.source),
  eq(conditionMappings.sourceCondition, key.sourceCondition),
)

const assertConditionAllowed = (category: string, kairosCondition: string): void => {
  if (!isProductCategory(category) || !isConditionAllowed(category, kairosCondition as ConditionCode)) {
    throw new ConditionMappingConditionNotAllowedError()
  }
}

const notFound = () => createError({ statusCode: 404, statusMessage: 'Introuvable' })

export const listConditionMappings = async (
  database: KairosDatabase,
): Promise<{ mappings: ConditionMapping[], rules: TitleConditionRule[] }> => ({
  mappings: await database
    .select()
    .from(conditionMappings)
    .orderBy(asc(conditionMappings.category), asc(conditionMappings.source), asc(conditionMappings.sourceCondition)),
  rules: await database
    .select()
    .from(titleConditionRules)
    .orderBy(asc(titleConditionRules.category), desc(titleConditionRules.priority)),
})

export const upsertConditionMapping = async (
  database: KairosDatabase,
  userId: string,
  draft: ConditionMappingDraft,
): Promise<ConditionMapping> => {
  assertConditionAllowed(draft.category, draft.kairosCondition)
  return database.transaction(async (transaction) => {
    const [previousMapping] = await transaction.select().from(conditionMappings).where(mappingKeyCondition(draft))
    const [savedMapping] = await transaction
      .insert(conditionMappings)
      .values(draft)
      .onConflictDoUpdate({
        target: [conditionMappings.category, conditionMappings.source, conditionMappings.sourceCondition],
        set: { kairosCondition: draft.kairosCondition },
      })
      .returning()
    await appendCatalogueChanges(transaction, [{
      productId: null,
      subject: conditionMappingSubject,
      userId,
      fieldName: mappingFieldName(draft),
      previousValue: previousMapping?.kairosCondition ?? null,
      newValue: draft.kairosCondition,
    }])
    return savedMapping!
  })
}

export const deleteConditionMapping = async (
  database: KairosDatabase,
  userId: string,
  key: ConditionMappingKey,
): Promise<void> => {
  await database.transaction(async (transaction) => {
    const [deletedMapping] = await transaction.delete(conditionMappings).where(mappingKeyCondition(key)).returning()
    if (!deletedMapping) {
      throw notFound()
    }
    await appendCatalogueChanges(transaction, [{
      productId: null,
      subject: conditionMappingSubject,
      userId,
      fieldName: mappingFieldName(key),
      previousValue: deletedMapping.kairosCondition,
      newValue: null,
    }])
  })
}

const assertRuleDraftValid = (draft: Omit<TitleConditionRule, 'id'>): void => {
  assertConditionAllowed(draft.category, draft.kairosCondition)
}

const foldKeyword = (keyword: string): string =>
  keyword.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const keywordSetKey = (keywords: string[]): string =>
  [...new Set(keywords.map(foldKeyword))].sort().join('\u0000')

const assertNoDuplicateTitleRule = async (
  database: KairosDatabase,
  draft: Pick<TitleConditionRule, 'category' | 'keywords'>,
  ignoredRuleId: string | null,
): Promise<void> => {
  const rulesOfCategory = await database
    .select({ id: titleConditionRules.id, keywords: titleConditionRules.keywords })
    .from(titleConditionRules)
    .where(eq(titleConditionRules.category, draft.category))
  const draftKey = keywordSetKey(draft.keywords)
  if (rulesOfCategory.some(rule => rule.id !== ignoredRuleId && keywordSetKey(rule.keywords) === draftKey)) {
    throw new DuplicateTitleRuleError()
  }
}

const findTitleRuleOr404 = async (database: KairosDatabase, ruleId: string): Promise<TitleConditionRule> => {
  const [rule] = uuidPattern.test(ruleId)
    ? await database.select().from(titleConditionRules).where(eq(titleConditionRules.id, ruleId))
    : []
  if (!rule) {
    throw notFound()
  }
  return rule
}

const describeRule = (rule: Omit<TitleConditionRule, 'id'>) => ({
  category: rule.category,
  keywords: rule.keywords,
  kairosCondition: rule.kairosCondition,
  priority: rule.priority,
})

export const createTitleRule = async (
  database: KairosDatabase,
  userId: string,
  draft: TitleRuleDraft,
): Promise<TitleConditionRule> => {
  assertRuleDraftValid(draft)
  return database.transaction(async (transaction) => {
    await assertNoDuplicateTitleRule(transaction as unknown as KairosDatabase, draft, null)
    const [createdRule] = await transaction.insert(titleConditionRules).values(draft).returning()
    await appendCatalogueChanges(transaction, [{
      productId: null,
      subject: titleRuleSubject,
      userId,
      fieldName: createdRule!.id,
      previousValue: null,
      newValue: describeRule(createdRule!),
    }])
    return createdRule!
  })
}

export const updateTitleRule = async (
  database: KairosDatabase,
  userId: string,
  ruleId: string,
  changes: Partial<TitleRuleDraft>,
): Promise<TitleConditionRule> => {
  const previousRule = await findTitleRuleOr404(database, ruleId)
  const mergedDraft = { ...describeRule(previousRule), ...changes }
  assertRuleDraftValid(mergedDraft)
  return database.transaction(async (transaction) => {
    await assertNoDuplicateTitleRule(transaction as unknown as KairosDatabase, mergedDraft, ruleId)
    const [updatedRule] = await transaction
      .update(titleConditionRules)
      .set(mergedDraft)
      .where(eq(titleConditionRules.id, ruleId))
      .returning()
    await appendCatalogueChanges(transaction, [{
      productId: null,
      subject: titleRuleSubject,
      userId,
      fieldName: ruleId,
      previousValue: describeRule(previousRule),
      newValue: describeRule(updatedRule!),
    }])
    return updatedRule!
  })
}

export const deleteTitleRule = async (database: KairosDatabase, userId: string, ruleId: string): Promise<void> => {
  const previousRule = await findTitleRuleOr404(database, ruleId)
  await database.transaction(async (transaction) => {
    await transaction.delete(titleConditionRules).where(eq(titleConditionRules.id, ruleId))
    await appendCatalogueChanges(transaction, [{
      productId: null,
      subject: titleRuleSubject,
      userId,
      fieldName: ruleId,
      previousValue: describeRule(previousRule),
      newValue: null,
    }])
  })
}
