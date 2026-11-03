import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { openDatabase } from '../../server/database/open-database.ts'
import { stockValueSnapshots, users } from '../../server/database/schema/index.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const firstPassword = 'first-password-123'
const secondPassword = 'second-password-123'

const millisecondsPerDay = 24 * 60 * 60 * 1000

const parisCalendarDateDaysAgo = (dayCount: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - dayCount * millisecondsPerDay))

const valuePoint = (ownerId: string, daysAgo: number, estimatedValueCents: number) => ({
  ownerId,
  snapshotOn: parisCalendarDateDaysAgo(daysAgo),
  purchaseCostCents: 1000,
  valuedPurchaseCostCents: 1000,
  estimatedValueCents,
  valuedItemCount: 1,
  approximateItemCount: 0,
  unvaluedItemCount: 0,
})

const seedValueHistory = async (databaseUrl: string): Promise<void> => {
  const database = await openDatabase(databaseUrl)
  const members = await database.select({ id: users.id, email: users.email }).from(users)
  const idOf = (email: string) => members.find(member => member.email === email)!.id
  await database.insert(stockValueSnapshots).values([
    valuePoint(idOf('first@example.com'), 2, 1111),
    valuePoint(idOf('first@example.com'), 1, 2222),
    valuePoint(idOf('second@example.com'), 1, 9999),
  ])
  await (database as unknown as { $client: { close: () => Promise<void> } }).$client.close()
}

describe('stock value history', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'first@example.com', displayName: 'First', password: firstPassword, isAdmin: false },
    { email: 'second@example.com', displayName: 'Second', password: secondPassword, isAdmin: false },
  ])
  await seedValueHistory(databaseUrl)
  await startEndToEndServer(databaseUrl)

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/stock/value-history')).status).toBe(401)
  })

  it('serves each member only their own points', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)

    const firstHistory = await $fetch<{ estimatedValueCents: number }[]>('/api/stock/value-history', { headers: { cookie: firstCookie } })
    const secondHistory = await $fetch<{ estimatedValueCents: number }[]>('/api/stock/value-history', { headers: { cookie: secondCookie } })

    expect(firstHistory.map(point => point.estimatedValueCents)).toEqual([1111, 2222])
    expect(secondHistory.map(point => point.estimatedValueCents)).toEqual([9999])
  })
})
