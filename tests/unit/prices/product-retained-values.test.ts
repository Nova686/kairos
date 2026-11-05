import { describe, expect, it } from 'vitest'
import { priceSnapshots, products, users } from '../../../server/database/schema/index.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { productPriceOverview } from '../../../server/domain/prices/product-price-overview.ts'
import { loadValuationSnapshots } from '../../../server/domain/valuation/load-valuation-snapshots.ts'
import { estimateStockItemValue } from '../../../shared/valuation/estimate-stock-item-value.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')
const daysBefore = (days: number): Date => new Date(now.getTime() - days * 86_400_000)

const insertProduct = async (database: KairosDatabase, category: string) => {
  const [member] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
  const [product] = await database.insert(products).values({ name: 'Display', category, createdByUserId: member!.id }).returning()
  return product!
}

const insertSnapshot = async (database: KairosDatabase, productId: string, overrides: Partial<typeof priceSnapshots.$inferInsert>) => {
  await database.insert(priceSnapshots).values({
    productId,
    source: 'ebay',
    kind: 'active',
    kairosCondition: 'sealed-new',
    observedAt: now,
    medianCents: 10000,
    listingCount: 3,
    ...overrides,
  })
}

describe('productPriceOverview retained values', () => {
  it('gives the same value as the stock valuation, mixing manual and automatic snapshots, ignoring stale ones', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'pokemon-sealed')
    await insertSnapshot(database, product.id, { source: 'ebay', medianCents: 15000, observedAt: daysBefore(1) })
    await insertSnapshot(database, product.id, { source: 'vinted', kind: 'manual', medianCents: 14000, observedAt: daysBefore(2) })
    await insertSnapshot(database, product.id, { source: 'vinted', kind: 'manual', medianCents: 16000, observedAt: daysBefore(3) })
    await insertSnapshot(database, product.id, { source: 'vinted', kind: 'active', medianCents: 99000, observedAt: daysBefore(20) })
    await insertSnapshot(database, product.id, { source: 'cardmarket', medianCents: 90000, observedAt: daysBefore(10) })

    const overview = await productPriceOverview(database, product.id, now)

    const snapshots = (await loadValuationSnapshots(database, [product.id], now)).get(product.id)!
    const expected = estimateStockItemValue({ category: 'pokemon-sealed', condition: 'sealed-new', gradingCompany: null, grade: null }, snapshots, now)
    const retained = overview.retainedValues.find(entry => entry.condition === 'sealed-new')!
    expect(retained.valueCents).toBe(expected.valueCents)
    expect(retained.valueCents).toBe(15000)
    expect(retained.approximate).toBe(false)
  })

  it('falls back to the closest condition and says so', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'pokemon-sealed')
    await insertSnapshot(database, product.id, { kairosCondition: 'sealed-damaged-box', medianCents: 8000, observedAt: daysBefore(1) })

    const overview = await productPriceOverview(database, product.id, now)

    const snapshots = (await loadValuationSnapshots(database, [product.id], now)).get(product.id)!
    const expected = estimateStockItemValue({ category: 'pokemon-sealed', condition: 'sealed-new', gradingCompany: null, grade: null }, snapshots, now)
    const retained = overview.retainedValues.find(entry => entry.condition === 'sealed-new')!
    expect(retained).toMatchObject({ valueCents: expected.valueCents, approximate: true, usedCondition: expected.usedCondition })
    expect(retained.valueCents).toBe(8000)
    expect(retained.usedCondition).toBe('sealed-damaged-box')
  })

  it('has no value for a condition without any usable snapshot', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'pokemon-sealed')

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.retainedValues).toHaveLength(4)
    expect(overview.retainedValues.every(entry => entry.valueCents === null && !entry.approximate)).toBe(true)
  })

  it('gives one entry per graded column, valued with the grading company and grade', async () => {
    const database = await createTestDatabase()
    const product = await insertProduct(database, 'graded-card')
    await insertSnapshot(database, product.id, { kairosCondition: 'graded', gradingCompany: 'PSA', grade: '10', medianCents: 50000, observedAt: daysBefore(1) })
    await insertSnapshot(database, product.id, { kairosCondition: 'graded', gradingCompany: 'PSA', grade: '9', medianCents: 20000, observedAt: daysBefore(1) })

    const overview = await productPriceOverview(database, product.id, now)

    expect(overview.retainedValues.map(entry => [entry.gradingCompany, entry.grade, entry.valueCents])).toEqual([
      ['PSA', '10', 50000],
      ['PSA', '9', 20000],
    ])
  })
})
