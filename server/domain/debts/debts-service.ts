import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { debts, persons, products, purchases, sales, stockItems } from '../../database/schema/index.ts'
import { findOwnedOr404 } from '../ownership/find-owned-or-404.ts'

export type Debt = typeof debts.$inferSelect

export type DebtDraft = {
  personId: string
  amountCents: number
  direction: Debt['direction']
  reason: string
  purchaseId: string | null
  saleId: string | null
  stockItemId: string | null
  createdOn: string
}

export type DebtWithLabels = Debt & { personName: string, stockItemProductName: string | null }

export type DebtBalance = {
  personId: string
  personName: string
  owedToMeCents: number
  iOweCents: number
  balanceCents: number
}

export const createDebt = async (database: KairosDatabase, ownerId: string, draft: DebtDraft): Promise<Debt> => {
  if (!Number.isInteger(draft.amountCents) || draft.amountCents <= 0) {
    throw createError({ statusCode: 422, statusMessage: 'Le montant d\'une dette est strictement positif' })
  }
  await findOwnedOr404(database, persons, draft.personId, ownerId)
  if (draft.purchaseId !== null) {
    await findOwnedOr404(database, purchases, draft.purchaseId, ownerId)
  }
  if (draft.saleId !== null) {
    await findOwnedOr404(database, sales, draft.saleId, ownerId)
  }
  if (draft.stockItemId !== null) {
    await findOwnedOr404(database, stockItems, draft.stockItemId, ownerId)
  }
  const [createdDebt] = await database
    .insert(debts)
    .values({
      ownerId,
      personId: draft.personId,
      amountCents: draft.amountCents,
      direction: draft.direction,
      reason: draft.reason,
      purchaseId: draft.purchaseId,
      saleId: draft.saleId,
      stockItemId: draft.stockItemId,
      createdOn: draft.createdOn,
    })
    .returning()
  return createdDebt!
}

export const settleDebt = async (
  database: KairosDatabase,
  ownerId: string,
  debtId: string,
  settledOn: string,
): Promise<Debt> => {
  const debt = await findOwnedOr404(database, debts, debtId, ownerId)
  const [settledDebt] = await database
    .update(debts)
    .set({ settledOn })
    .where(and(eq(debts.id, debt.id), eq(debts.ownerId, ownerId), isNull(debts.settledOn)))
    .returning()
  if (!settledDebt) {
    throw createError({ statusCode: 409, statusMessage: 'Dette déjà soldée' })
  }
  return settledDebt
}

export const deleteDebt = async (database: KairosDatabase, ownerId: string, debtId: string): Promise<void> => {
  const debt = await findOwnedOr404(database, debts, debtId, ownerId)
  const deletedDebts = await database
    .delete(debts)
    .where(and(eq(debts.id, debt.id), eq(debts.ownerId, ownerId), isNull(debts.settledOn)))
    .returning({ id: debts.id })
  if (deletedDebts.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'Une dette soldée ne peut pas être supprimée' })
  }
}

export const listDebts = async (
  database: KairosDatabase,
  ownerId: string,
  filter: { settled?: boolean },
): Promise<DebtWithLabels[]> => {
  const settledCondition = filter.settled === undefined
    ? undefined
    : filter.settled ? isNotNull(debts.settledOn) : isNull(debts.settledOn)
  const rows = await database
    .select({ debt: debts, personName: persons.name, stockItemProductName: products.name })
    .from(debts)
    .innerJoin(persons, eq(persons.id, debts.personId))
    .leftJoin(stockItems, eq(stockItems.id, debts.stockItemId))
    .leftJoin(products, eq(products.id, stockItems.productId))
    .where(and(eq(debts.ownerId, ownerId), settledCondition))
    .orderBy(desc(debts.createdOn), desc(debts.id))
  return rows.map(row => ({ ...row.debt, personName: row.personName, stockItemProductName: row.stockItemProductName }))
}

export const computeDebtBalances = async (database: KairosDatabase, ownerId: string): Promise<DebtBalance[]> => {
  const openDebts = await listDebts(database, ownerId, { settled: false })
  const balancesByPersonId = new Map<string, DebtBalance>()
  for (const openDebt of openDebts) {
    const balance = balancesByPersonId.get(openDebt.personId)
      ?? { personId: openDebt.personId, personName: openDebt.personName, owedToMeCents: 0, iOweCents: 0, balanceCents: 0 }
    if (openDebt.direction === 'owed-to-me') {
      balance.owedToMeCents += openDebt.amountCents
    }
    else {
      balance.iOweCents += openDebt.amountCents
    }
    balance.balanceCents = balance.owedToMeCents - balance.iOweCents
    balancesByPersonId.set(openDebt.personId, balance)
  }
  return [...balancesByPersonId.values()].sort(
    (left, right) => Math.abs(right.balanceCents) - Math.abs(left.balanceCents) || left.personName.localeCompare(right.personName),
  )
}
