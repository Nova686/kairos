import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-123'

const millisecondsPerDay = 24 * 60 * 60 * 1000

const parisCalendarDateDaysAgo = (dayCount: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - dayCount * millisecondsPerDay))

describe('dashboard', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 401 on the overview without a session', async () => {
    expect((await fetch('/api/dashboard')).status).toBe(401)
  })

  it('shows the current stock value computed from a fresh manual price', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Display Écarlate', category: 'pokemon-sealed' },
      headers: { cookie },
    })
    await $fetch('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: parisCalendarDateDaysAgo(2),
        totalPriceCents: 10000,
        feesCents: 0,
        inTransit: false,
        lines: [{ productId: product.id, condition: 'sealed-new' }],
      },
      headers: { cookie },
    })
    await $fetch(`/api/products/${product.id}/manual-prices`, {
      method: 'POST',
      body: {
        source: 'vinted',
        kairosCondition: 'sealed-new',
        priceCents: 123456,
        observedOn: parisCalendarDateDaysAgo(1),
      },
      headers: { cookie },
    })

    const overview = await $fetch<{ stockValue: { estimatedValueCents: number }, valueHistory: unknown[] }>('/api/dashboard', { headers: { cookie } })
    const dashboardPage = await $fetch<string>('/', { headers: { cookie } })

    expect(overview.stockValue.estimatedValueCents).toBe(123456)
    expect(dashboardPage).toContain('Valeur actuelle')
    expect(dashboardPage).toMatch(/1\s234,56/)
    expect(overview.valueHistory).toEqual([])
    expect(dashboardPage).toContain('Coût et valeur dans le temps')
    expect(dashboardPage).toContain('Pas encore d’historique')
  })
})
