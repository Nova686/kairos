import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { priceSnapshotListings, priceSnapshots, products, users } from '../../../server/database/schema/index.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { recordManualPrice } from '../../../server/domain/prices/manual-price-entries.ts'
import { parisNoonOf } from '../../../server/domain/prices/start-of-paris-day.ts'
import { loadValuationSnapshots } from '../../../server/domain/valuation/load-valuation-snapshots.ts'
import { updateProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import { listProductChanges } from '../../../server/domain/catalogue/catalogue-journal.ts'
import { manualPriceDraftSchema } from '../../../shared/prices/manual-price-draft-schema.ts'
import { estimateStockItemValue } from '../../../shared/valuation/estimate-stock-item-value.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-02T12:00:00Z')

const insertProduct = async (database: KairosDatabase, category: string) => {
  const [member] = await database.insert(users).values({ email: 'a@x.fr', displayName: 'A', passwordHash: 'x' }).returning()
  const [product] = await database.insert(products).values({ name: 'Peluche', category, createdByUserId: member!.id }).returning()
  return { memberId: member!.id, product: product! }
}

const draft = (overrides: Record<string, unknown> = {}) =>
  manualPriceDraftSchema.parse({
    source: 'vinted',
    kairosCondition: 'very-good',
    priceCents: 2500,
    observedOn: '2026-11-01',
    ...overrides,
  })

describe('recordManualPrice', () => {
  it('stores one manual snapshot that the valuation uses for a matching condition', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')

    await recordManualPrice(database, memberId, product.id, draft())

    const snapshotsByProduct = await loadValuationSnapshots(database, [product.id], now)
    const valuation = estimateStockItemValue(
      { category: 'toy', condition: 'very-good', gradingCompany: null, grade: null },
      snapshotsByProduct.get(product.id)!,
      now,
    )
    expect(valuation).toMatchObject({ valueCents: 2500, approximate: false, usedCondition: 'very-good' })
    expect(valuation.perSource.map(entry => entry.source)).toEqual(['vinted'])
  })

  it('records the figures, the author and the listing link', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')

    const snapshotId = await recordManualPrice(database, memberId, product.id, draft({ url: 'https://www.vinted.fr/items/1' }))

    const [snapshot] = await database.select().from(priceSnapshots).where(eq(priceSnapshots.id, snapshotId))
    expect(snapshot).toMatchObject({
      kind: 'manual',
      source: 'vinted',
      kairosCondition: 'very-good',
      listingCount: 1,
      averageCents: 2500,
      medianCents: 2500,
      lowCents: 2500,
      createdByUserId: memberId,
    })
    const listings = await database.select().from(priceSnapshotListings).where(eq(priceSnapshotListings.snapshotId, snapshotId))
    expect(listings).toHaveLength(1)
    expect(listings[0]).toMatchObject({ url: 'https://www.vinted.fr/items/1', priceCents: 2500 })
  })

  it('stores no listing row without a link', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')

    await recordManualPrice(database, memberId, product.id, draft())

    expect(await database.select().from(priceSnapshotListings)).toHaveLength(0)
  })

  it('stores the observation day at Paris noon in winter and summer', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')

    const winterId = await recordManualPrice(database, memberId, product.id, draft({ observedOn: '2026-11-01' }))
    const summerId = await recordManualPrice(database, memberId, product.id, draft({ observedOn: '2026-07-01' }))

    const [winter] = await database.select().from(priceSnapshots).where(eq(priceSnapshots.id, winterId))
    const [summer] = await database.select().from(priceSnapshots).where(eq(priceSnapshots.id, summerId))
    expect(winter!.observedAt.toISOString()).toBe('2026-11-01T11:00:00.000Z')
    expect(summer!.observedAt.toISOString()).toBe('2026-07-01T10:00:00.000Z')
    expect(parisNoonOf('2026-03-29').toISOString()).toBe('2026-03-29T10:00:00.000Z')
  })

  it('rejects a condition that the category does not allow with 422', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')

    await expect(recordManualPrice(database, memberId, product.id, draft({ kairosCondition: 'sealed-new' })))
      .rejects.toMatchObject({ statusCode: 422 })
    expect(await database.select().from(priceSnapshots)).toHaveLength(0)
  })

  it('requires the grading company and the grade for a graded card', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'graded-card')

    await expect(recordManualPrice(database, memberId, product.id, draft({ kairosCondition: 'graded' })))
      .rejects.toMatchObject({ statusCode: 422 })
    await expect(recordManualPrice(database, memberId, product.id, draft({ kairosCondition: 'graded', gradingCompany: 'PSA' })))
      .rejects.toMatchObject({ statusCode: 422 })

    await recordManualPrice(database, memberId, product.id, draft({ kairosCondition: 'graded', gradingCompany: 'PSA', grade: '10' }))
    const [snapshot] = await database.select().from(priceSnapshots)
    expect(snapshot).toMatchObject({ gradingCompany: 'PSA', grade: '10' })
  })

  it('stores the canonical grading company name', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'graded-card')

    await recordManualPrice(database, memberId, product.id, draft({ kairosCondition: 'graded', gradingCompany: 'psa', grade: '10' }))

    const [snapshot] = await database.select().from(priceSnapshots)
    expect(snapshot).toMatchObject({ gradingCompany: 'PSA' })
  })

  it('answers 404 for an unknown product', async () => {
    const database = await createTestDatabase()
    const { memberId } = await insertProduct(database, 'toy')

    await expect(recordManualPrice(database, memberId, '00000000-0000-4000-8000-000000000000', draft()))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('manual price validation', () => {
  it('rejects a future observation day in Paris but accepts today', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')
    const lateEvening = new Date('2026-11-02T23:30:00Z')

    await expect(recordManualPrice(database, memberId, product.id, draft({ observedOn: '2026-11-04' }), lateEvening))
      .rejects.toMatchObject({ statusCode: 422 })
    await expect(recordManualPrice(database, memberId, product.id, draft({ observedOn: '2026-11-03' }), lateEvening))
      .resolves.toEqual(expect.any(String))
    await expect(recordManualPrice(database, memberId, product.id, draft({ observedOn: '2026-11-03' }), now))
      .rejects.toMatchObject({ statusCode: 422 })
  })

  it('accepts only numeric grades from 1 to 10 with an optional half point', () => {
    const parseGrade = (grade: string) => manualPriceDraftSchema.safeParse({
      source: 'other', kairosCondition: 'graded', gradingCompany: 'PSA', grade, priceCents: 100, observedOn: '2026-11-01',
    }).success
    expect(['10', '9.5', '1'].map(parseGrade)).toEqual([true, true, true])
    expect(['0', '11', 'Mint', '9,5', '9.25', '10.5'].map(parseGrade)).toEqual([false, false, false, false, false, false])
  })
})

describe('manualPriceDraftSchema', () => {
  it('rejects non-positive prices, unknown sources, impossible dates and non-http links', () => {
    expect(manualPriceDraftSchema.safeParse({ source: 'vinted', kairosCondition: 'good', priceCents: 0, observedOn: '2026-11-01' }).success).toBe(false)
    expect(manualPriceDraftSchema.safeParse({ source: 'ebay', kairosCondition: 'good', priceCents: 100, observedOn: '2026-11-01' }).success).toBe(false)
    expect(manualPriceDraftSchema.safeParse({ source: 'other', kairosCondition: 'good', priceCents: 100, observedOn: '2026-02-30' }).success).toBe(false)
    expect(manualPriceDraftSchema.safeParse({ source: 'other', kairosCondition: 'good', priceCents: 100, observedOn: '2026-11-01', url: 'javascript:alert(1)' }).success).toBe(false)
    expect(manualPriceDraftSchema.safeParse({ source: 'leboncoin', kairosCondition: 'good', priceCents: 100, observedOn: '2026-11-01', url: 'https://www.leboncoin.fr/a/1' }).success).toBe(true)
  })
})

describe('eBay search settings', () => {
  it('journals edits of the eBay query and excluded keywords', async () => {
    const database = await createTestDatabase()
    const { memberId, product } = await insertProduct(database, 'toy')

    await updateProduct(database, memberId, product.id, { ebayQuery: 'peluche ours', ebayExcludedKeywords: ['lot'] })

    const changes = await listProductChanges(database, product.id)
    expect(changes.map(change => change.fieldName).sort()).toEqual(['ebayExcludedKeywords', 'ebayQuery'])
    expect(changes.find(change => change.fieldName === 'ebayQuery')).toMatchObject({ previousValue: null, newValue: 'peluche ours' })
  })
})
