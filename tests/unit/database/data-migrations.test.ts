import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { stockValueSnapshots, titleConditionRules, users } from '../../../server/database/schema/index.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const migrationsFolder = resolve(process.cwd(), 'server/database/migrations')

const replayMigration = async (database: KairosDatabase, fileName: string): Promise<void> => {
  const statements = readFileSync(resolve(migrationsFolder, fileName), 'utf8')
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0)
  for (const statement of statements) {
    await database.execute(sql.raw(statement))
  }
}

describe('0006 valued purchase cost', () => {
  it('backfills the valued purchase cost with the purchase cost', async () => {
    const database = await createTestDatabase()
    await database.execute(sql.raw('ALTER TABLE "stock_value_snapshots" DROP COLUMN "valued_purchase_cost_cents"'))
    const [owner] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
    await database.execute(sql`insert into stock_value_snapshots
      (owner_id, snapshot_on, purchase_cost_cents, estimated_value_cents, valued_item_count, approximate_item_count, unvalued_item_count)
      values (${owner!.id}, '2026-10-01', 4200, 5000, 1, 0, 0)`)

    await replayMigration(database, '0006_valued_purchase_cost.sql')

    const [row] = await database.select().from(stockValueSnapshots)
    expect(row).toMatchObject({ purchaseCostCents: 4200, valuedPurchaseCostCents: 4200 })
  })
})

describe('0007 title rule keyword stars', () => {
  it('converts the seeded prefix keywords and leaves edited rules alone', async () => {
    const database = await createTestDatabase()
    const seededRules = await database.select().from(titleConditionRules)
    const ruleOfPriority = (priority: number) => seededRules.find(rule => rule.priority === priority)!
    await database.update(titleConditionRules)
      .set({ keywords: ['vide', 'empty', 'sans cartes', 'incompl'] })
      .where(eq(titleConditionRules.id, ruleOfPriority(30).id))
    await database.update(titleConditionRules)
      .set({ keywords: ['abîm', 'abim', 'cabossé', 'dented', 'damaged', 'enfonc'] })
      .where(eq(titleConditionRules.id, ruleOfPriority(10).id))
    const [editedRule] = await database.insert(titleConditionRules)
      .values({ category: 'pokemon-sealed', keywords: ['abîm'], kairosCondition: 'sealed-damaged-box', priority: 5 })
      .returning()

    await replayMigration(database, '0007_title_rule_keyword_stars.sql')

    const keywordsById = new Map((await database.select().from(titleConditionRules)).map(rule => [rule.id, rule.keywords]))
    expect(keywordsById.get(ruleOfPriority(30).id)).toEqual(['vide', 'empty', 'sans cartes', 'incompl*'])
    expect(keywordsById.get(ruleOfPriority(20).id)).toEqual(['ouvert', 'opened', 'open'])
    expect(keywordsById.get(ruleOfPriority(10).id)).toEqual(['abîm*', 'abim*', 'cabossé*', 'dented', 'damaged', 'enfonc*'])
    expect(keywordsById.get(editedRule!.id)).toEqual(['abîm'])
  })
})
