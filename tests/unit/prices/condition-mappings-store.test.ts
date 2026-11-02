import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { catalogueChanges, conditionMappings, titleConditionRules, users } from '../../../server/database/schema/index.ts'
import { seedConditionMappings } from '../../../server/database/seeds/condition-mappings.ts'
import {
  ConditionMappingConditionNotAllowedError,
  createTitleRule,
  deleteConditionMapping,
  deleteTitleRule,
  listConditionMappings,
  updateTitleRule,
  upsertConditionMapping,
} from '../../../server/domain/prices/condition-mappings-store.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertMember = async (database: KairosDatabase): Promise<string> => {
  const [member] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
  return member!.id
}

describe('seeding', () => {
  it('is applied when the database opens and stays idempotent', async () => {
    const database = await createTestDatabase()
    const mappingCount = (await database.select().from(conditionMappings)).length
    const ruleCount = (await database.select().from(titleConditionRules)).length
    expect(mappingCount).toBe(15)
    expect(ruleCount).toBe(3)
    await seedConditionMappings(database)
    expect(await database.select().from(conditionMappings)).toHaveLength(mappingCount)
    expect(await database.select().from(titleConditionRules)).toHaveLength(ruleCount)
  })

  it('keeps an edited mapping when seeding again', async () => {
    const database = await createTestDatabase()
    const memberId = await insertMember(database)
    await upsertConditionMapping(database, memberId, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'satisfactory',
    })
    await seedConditionMappings(database)
    const [edited] = await database.select().from(conditionMappings).where(eq(conditionMappings.sourceCondition, 'Occasion'))
    expect(edited).toBeDefined()
    const toyMapping = (await database.select().from(conditionMappings))
      .find(mapping => mapping.category === 'toy' && mapping.sourceCondition === 'Occasion')
    expect(toyMapping?.kairosCondition).toBe('satisfactory')
  })
})

describe('condition mappings store', () => {
  it('journals a mapping change without a product', async () => {
    const database = await createTestDatabase()
    const memberId = await insertMember(database)
    await upsertConditionMapping(database, memberId, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'satisfactory',
    })
    const [change] = await database.select().from(catalogueChanges)
    expect(change).toMatchObject({
      productId: null,
      subject: 'condition-mapping',
      fieldName: 'toy/ebay/Occasion',
      previousValue: 'good',
      newValue: 'satisfactory',
      userId: memberId,
    })
  })

  it('rejects a condition outside the category scale', async () => {
    const database = await createTestDatabase()
    const memberId = await insertMember(database)
    await expect(upsertConditionMapping(database, memberId, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'sealed-new',
    })).rejects.toBeInstanceOf(ConditionMappingConditionNotAllowedError)
  })

  it('adds and deletes a mapping with journal entries', async () => {
    const database = await createTestDatabase()
    const memberId = await insertMember(database)
    await upsertConditionMapping(database, memberId, {
      category: 'toy', source: 'ebay', sourceCondition: 'Pour pièces', kairosCondition: 'satisfactory',
    })
    await deleteConditionMapping(database, memberId, { category: 'toy', source: 'ebay', sourceCondition: 'Pour pièces' })
    const { mappings } = await listConditionMappings(database)
    expect(mappings.find(mapping => mapping.sourceCondition === 'Pour pièces')).toBeUndefined()
    const journal = await database.select().from(catalogueChanges)
    expect(journal.map(change => change.newValue)).toEqual(['satisfactory', null])
  })

  it('creates, updates and deletes title rules with journal entries', async () => {
    const database = await createTestDatabase()
    const memberId = await insertMember(database)
    const createdRule = await createTitleRule(database, memberId, {
      category: 'pokemon-sealed', keywords: ['scell'], kairosCondition: 'sealed-new', priority: 5,
    })
    const updatedRule = await updateTitleRule(database, memberId, createdRule.id, { priority: 6 })
    expect(updatedRule.priority).toBe(6)
    await deleteTitleRule(database, memberId, createdRule.id)
    const journal = await database.select().from(catalogueChanges)
    expect(journal.map(change => change.subject)).toEqual(['title-rule', 'title-rule', 'title-rule'])
    expect((await listConditionMappings(database)).rules).toHaveLength(3)
  })
})
