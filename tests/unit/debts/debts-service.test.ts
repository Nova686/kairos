import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { persons, products, users } from '../../../server/database/schema/index.ts'
import { createPurchase } from '../../../server/domain/stock/purchases-service.ts'
import { createSale } from '../../../server/domain/sales/sales-service.ts'
import {
  computeDebtBalances,
  createDebt,
  deleteDebt,
  listDebts,
  settleDebt,
  type DebtDraft,
} from '../../../server/domain/debts/debts-service.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertOwner = async (database: KairosDatabase, email: string): Promise<string> => {
  const [owner] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return owner!.id
}

const insertPerson = async (database: KairosDatabase, ownerId: string, name = 'Camille'): Promise<string> => {
  const [person] = await database.insert(persons).values({ ownerId, name }).returning()
  return person!.id
}

const buildDebtDraft = (personId: string, overrides: Partial<DebtDraft> = {}): DebtDraft => ({
  personId,
  amountCents: 2000,
  direction: 'owed-to-me',
  reason: 'Vente à crédit',
  purchaseId: null,
  saleId: null,
  stockItemId: null,
  createdOn: '2026-11-02',
  ...overrides,
})

const insertSaleWithStockItem = async (database: KairosDatabase, ownerId: string) => {
  const [product] = await database.insert(products).values({ name: 'Display', category: 'pokemon-sealed', createdByUserId: ownerId }).returning()
  const { purchase, stockItems: createdStockItems } = await createPurchase(database, ownerId, {
    purchasedOn: '2026-11-01',
    sellerLabel: null,
    totalPriceCents: 1000,
    feesCents: 0,
    trackingReference: null,
    inTransit: false,
    lines: [{
      productId: product!.id,
      condition: 'sealed-new',
      gradingCompany: null,
      grade: null,
      certificateNumber: null,
      locationId: null,
      allocatedPurchaseCents: 1000,
    }],
  })
  const { sale } = await createSale(database, ownerId, {
    soldOn: '2026-11-02',
    platform: 'Vinted',
    buyerPersonId: null,
    totalPriceCents: 2000,
    shippingIncluded: false,
    shippingCostCents: 0,
    platformFeesCents: 0,
    packagingCostCents: 0,
    trackingReference: null,
    stockItemIds: [createdStockItems[0]!.id],
  })
  return { purchaseId: purchase.id, saleId: sale.id, stockItemId: createdStockItems[0]!.id }
}

const expectStatus = async (action: Promise<unknown>, statusCode: number): Promise<void> => {
  await expect(action).rejects.toMatchObject({ statusCode })
}

describe('createDebt', () => {
  it('stores a debt for an owned person', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)

    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))

    expect(debt).toMatchObject({ ownerId, personId, amountCents: 2000, direction: 'owed-to-me', settledOn: null })
  })

  it('rejects a non-positive amount with 422', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)

    await expectStatus(createDebt(database, ownerId, buildDebtDraft(personId, { amountCents: 0 })), 422)
  })

  it('answers 404 for another user person', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherId = await insertOwner(database, 'b@example.com')
    const foreignPersonId = await insertPerson(database, otherId)

    await expectStatus(createDebt(database, ownerId, buildDebtDraft(foreignPersonId)), 404)
  })

  it('answers 404 when linking another user sale, purchase or stock item', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherId = await insertOwner(database, 'b@example.com')
    const personId = await insertPerson(database, ownerId)
    const foreign = await insertSaleWithStockItem(database, otherId)

    await expectStatus(createDebt(database, ownerId, buildDebtDraft(personId, { saleId: foreign.saleId })), 404)
    await expectStatus(createDebt(database, ownerId, buildDebtDraft(personId, { purchaseId: foreign.purchaseId })), 404)
    await expectStatus(createDebt(database, ownerId, buildDebtDraft(personId, { stockItemId: foreign.stockItemId })), 404)
  })

  it('accepts links to owned sale, purchase and stock item', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)
    const owned = await insertSaleWithStockItem(database, ownerId)

    const debt = await createDebt(database, ownerId, buildDebtDraft(personId, owned))

    expect(debt).toMatchObject(owned)
  })
})

describe('settleDebt', () => {
  it('records the settlement date', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)
    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))

    const settled = await settleDebt(database, ownerId, debt.id, '2026-11-05')

    expect(settled.settledOn).toBe('2026-11-05')
  })

  it('answers 409 when settling twice', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)
    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))
    await settleDebt(database, ownerId, debt.id, '2026-11-05')

    await expectStatus(settleDebt(database, ownerId, debt.id, '2026-11-06'), 409)
  })

  it('answers 404 for another user debt', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherId = await insertOwner(database, 'b@example.com')
    const personId = await insertPerson(database, ownerId)
    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))

    await expectStatus(settleDebt(database, otherId, debt.id, '2026-11-05'), 404)
  })
})

describe('listDebts', () => {
  it('lists own debts with person name and filters on settled state', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherId = await insertOwner(database, 'b@example.com')
    const personId = await insertPerson(database, ownerId, 'Camille')
    const foreignPersonId = await insertPerson(database, otherId)
    const openDebt = await createDebt(database, ownerId, buildDebtDraft(personId))
    const settledDebt = await createDebt(database, ownerId, buildDebtDraft(personId, { amountCents: 500 }))
    await settleDebt(database, ownerId, settledDebt.id, '2026-11-05')
    await createDebt(database, otherId, buildDebtDraft(foreignPersonId))

    const everyDebt = await listDebts(database, ownerId, {})
    const openDebts = await listDebts(database, ownerId, { settled: false })
    const settledDebts = await listDebts(database, ownerId, { settled: true })

    expect(everyDebt).toHaveLength(2)
    expect(openDebts.map(debt => debt.id)).toEqual([openDebt.id])
    expect(settledDebts.map(debt => debt.id)).toEqual([settledDebt.id])
    expect(openDebts[0]!.personName).toBe('Camille')
  })

  it('includes the product name of a linked stock item', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)
    const owned = await insertSaleWithStockItem(database, ownerId)
    await createDebt(database, ownerId, buildDebtDraft(personId, { stockItemId: owned.stockItemId }))
    await createDebt(database, ownerId, buildDebtDraft(personId))

    const listed = await listDebts(database, ownerId, {})

    expect(listed.map(debt => debt.stockItemProductName).sort()).toEqual(['Display', null])
  })
})

describe('computeDebtBalances', () => {
  it('nets what is owed to me against what I owe per person', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId, 'Camille')
    await createDebt(database, ownerId, buildDebtDraft(personId, { amountCents: 2000 }))
    await createDebt(database, ownerId, buildDebtDraft(personId, { amountCents: 500, direction: 'i-owe' }))

    const balances = await computeDebtBalances(database, ownerId)

    expect(balances).toEqual([{ personId, personName: 'Camille', owedToMeCents: 2000, iOweCents: 500, balanceCents: 1500 }])
  })

  it('excludes settled debts and omits persons without open debt', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)
    await insertPerson(database, ownerId, 'Sans dette')
    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))
    await settleDebt(database, ownerId, debt.id, '2026-11-05')

    expect(await computeDebtBalances(database, ownerId)).toEqual([])
  })

  it('sorts by absolute balance descending and ignores other users', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherId = await insertOwner(database, 'b@example.com')
    const smallPersonId = await insertPerson(database, ownerId, 'Petit')
    const bigNegativePersonId = await insertPerson(database, ownerId, 'Gros')
    const foreignPersonId = await insertPerson(database, otherId)
    await createDebt(database, ownerId, buildDebtDraft(smallPersonId, { amountCents: 300 }))
    await createDebt(database, ownerId, buildDebtDraft(bigNegativePersonId, { amountCents: 900, direction: 'i-owe' }))
    await createDebt(database, otherId, buildDebtDraft(foreignPersonId, { amountCents: 5000 }))

    const balances = await computeDebtBalances(database, ownerId)

    expect(balances.map(balance => [balance.personName, balance.balanceCents])).toEqual([['Gros', -900], ['Petit', 300]])
  })
})

describe('deleteDebt', () => {
  it('deletes an unsettled debt', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const personId = await insertPerson(database, ownerId)
    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))

    await deleteDebt(database, ownerId, debt.id)

    expect(await listDebts(database, ownerId, {})).toEqual([])
  })

  it('answers 409 for a settled debt and 404 for another user debt', async () => {
    const database = await createTestDatabase()
    const ownerId = await insertOwner(database, 'a@example.com')
    const otherId = await insertOwner(database, 'b@example.com')
    const personId = await insertPerson(database, ownerId)
    const debt = await createDebt(database, ownerId, buildDebtDraft(personId))
    await expectStatus(deleteDebt(database, otherId, debt.id), 404)
    await settleDebt(database, ownerId, debt.id, '2026-11-05')

    await expectStatus(deleteDebt(database, ownerId, debt.id), 409)
  })
})
