import { startEndToEndServer, $fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-123'

const millisecondsPerDay = 24 * 60 * 60 * 1000

const parisCalendarDateDaysAgo = (dayCount: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - dayCount * millisecondsPerDay))

describe('stock and product pages', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('renders the stock list, the stock item and the product prices with the retained value', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'ETB Évolutions Prismatiques', category: 'pokemon-sealed' },
      headers: { cookie },
    })
    const purchase = await $fetch<{ stockItems: { id: string }[] }>('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: parisCalendarDateDaysAgo(2),
        totalPriceCents: 6500,
        feesCents: 0,
        inTransit: false,
        lines: [{ productId: product.id, condition: 'sealed-new' }],
      },
      headers: { cookie },
    })
    await $fetch(`/api/products/${product.id}/manual-prices`, {
      method: 'POST',
      body: { source: 'vinted', kairosCondition: 'sealed-new', priceCents: 15123, observedOn: parisCalendarDateDaysAgo(1) },
      headers: { cookie },
    })

    const stockPage = await $fetch<string>('/stock', { headers: { cookie } })
    const stockItemPage = await $fetch<string>(`/stock/${purchase.stockItems[0]!.id}`, { headers: { cookie } })
    const productPage = await $fetch<string>(`/produits/${product.id}`, { headers: { cookie } })

    expect(stockPage).toContain('Stock')
    expect(stockPage).toContain('Pokémon scellé')
    expect(stockItemPage).toContain('ETB Évolutions Prismatiques')
    expect(productPage).toContain('ETB Évolutions Prismatiques')
    expect(productPage).toContain('Valeur retenue')
    expect(productPage).toMatch(/151,23/)
    expect(productPage).toMatch(/65,00/)
    expect(productPage).toMatch(/\+86,23/)
  })

  it('shows on the phone stock card the status of an item that is not simply in stock', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const product = await $fetch<{ id: string }>('/api/products', {
      method: 'POST',
      body: { name: 'Coffret Dracaufeu en route', category: 'pokemon-sealed' },
      headers: { cookie },
    })
    await $fetch('/api/purchases', {
      method: 'POST',
      body: {
        purchasedOn: parisCalendarDateDaysAgo(1),
        totalPriceCents: 4200,
        feesCents: 0,
        inTransit: true,
        lines: [{ productId: product.id, condition: 'sealed-new' }],
      },
      headers: { cookie },
    })

    const stockPage = await $fetch<string>('/stock', { headers: { cookie } })
    const phoneListStart = stockPage.indexOf('stock-item-list kairos-phone-only')
    const phoneCards = stockPage.slice(phoneListStart, stockPage.indexOf('stock-item-list__table-card', phoneListStart))
    const cardsFromInTransitOne = phoneCards.slice(phoneCards.indexOf('Coffret Dracaufeu en route'))
    const nextCardStart = cardsFromInTransitOne.indexOf('stock-item-list__card')
    const inTransitCard = nextCardStart === -1 ? cardsFromInTransitOne : cardsFromInTransitOne.slice(0, nextCardStart)

    expect(inTransitCard).toMatch(/stock-item-list__status[\s\S]*en livraison/)
  })

  it('shows the signed-in member and the sign-out action in the side navigation', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const dashboardHtml = await $fetch<string>('/', { headers: { cookie } })
    const sideNavigationStart = dashboardHtml.indexOf('class="main-navigation')
    const sideNavigationHtml = dashboardHtml.slice(sideNavigationStart, dashboardHtml.indexOf('</nav>', sideNavigationStart))

    expect(sideNavigationHtml).toMatch(/signed-in-user-panel__display-name"[^>]*>Member</)
    expect(sideNavigationHtml).toContain('member@example.com')
    expect(sideNavigationHtml).toContain('Se déconnecter')
  })
})
