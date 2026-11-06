import { sql } from 'drizzle-orm'
import { check, date, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './accounts.ts'
import { persons, sales } from './sales.ts'
import { purchases, stockItems } from './stock.ts'

export const debts = pgTable('debts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  personId: uuid('person_id').notNull().references(() => persons.id, { onDelete: 'restrict' }),
  amountCents: integer('amount_cents').notNull(),
  direction: text('direction', { enum: ['owed-to-me', 'i-owe'] }).notNull(),
  reason: text('reason').notNull(),
  purchaseId: uuid('purchase_id').references(() => purchases.id, { onDelete: 'restrict' }),
  saleId: uuid('sale_id').references(() => sales.id, { onDelete: 'restrict' }),
  stockItemId: uuid('stock_item_id').references(() => stockItems.id, { onDelete: 'restrict' }),
  createdOn: date('created_on').notNull(),
  settledOn: date('settled_on'),
}, table => [
  check('debts_direction_check', sql`${table.direction} in ('owed-to-me', 'i-owe')`),
])
