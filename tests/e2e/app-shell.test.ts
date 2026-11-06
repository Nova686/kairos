import { startEndToEndServer, $fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-1'

const drawerEntryLabels = ['Tableau de bord', 'Stock', 'Ajouter', 'Ventes', 'Livraisons', 'Dettes', 'Lieux', 'Personnes', 'Réglages']

const mainNavigationTextOf = (pageHtml: string): string => {
  const navigationStart = pageHtml.slice(pageHtml.indexOf('aria-label="Navigation Kairos"'))
  return navigationStart
    .slice(0, navigationStart.indexOf('</nav>'))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
}

describe('application shell', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('sends an anonymous visitor to the sign-in page titled Kairos', async () => {
    const homePageHtml = await $fetch<string>('/')

    expect(homePageHtml).toContain('Kairos')
    expect(homePageHtml).toContain('Se connecter')
  })

  it('renders the nine navigation entries for a signed-in member', async () => {
    const cookie = await logIn('member@example.com', memberPassword)

    const stockPageHtml = await $fetch<string>('/stock', { headers: { cookie } })

    const navigationText = mainNavigationTextOf(stockPageHtml)
    const labelPositions = drawerEntryLabels.map(entryLabel => navigationText.indexOf(` ${entryLabel} `))
    expect(labelPositions.every(labelPosition => labelPosition >= 0)).toBe(true)
    expect(labelPositions).toEqual([...labelPositions].sort((first, second) => first - second))
  })
})
