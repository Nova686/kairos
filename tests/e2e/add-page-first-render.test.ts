import { startEndToEndServer, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'first-render-password'

const iPhoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const desktopUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'

const tabButtonPattern = /<button[^>]*role="tab"[^>]*>/g

const findTabButton = (pageHtml: string, tabValue: string): string | undefined =>
  pageHtml.match(tabButtonPattern)?.find(tabButton => tabButton.includes(`value="${tabValue}"`))

const isTabSelected = (tabButton: string | undefined): boolean =>
  /class="[^"]*\bv-tab--selected\b/.test(tabButton ?? '')

describe('add page first render', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  const fetchAddPage = async (headers: Record<string, string>): Promise<string> => {
    const cookie = await logIn('member@example.com', memberPassword)
    const page = await fetch('/ajouter', { headers: { cookie, ...headers } })
    expect(page.status).toBe(200)
    return page.text()
  }

  it('renders the barcode tab already selected for an iPhone', async () => {
    const pageHtml = await fetchAddPage({ 'user-agent': iPhoneUserAgent })

    expect(isTabSelected(findTabButton(pageHtml, 'code-barres'))).toBe(true)
    expect(isTabSelected(findTabButton(pageHtml, 'texte'))).toBe(false)
    expect(pageHtml).not.toContain('Le scan par code-barres et par photo se fait depuis l’iPhone.')
  })

  it('renders the barcode tab already selected when the browser hints a mobile device', async () => {
    const pageHtml = await fetchAddPage({ 'user-agent': desktopUserAgent, 'sec-ch-ua-mobile': '?1' })

    expect(isTabSelected(findTabButton(pageHtml, 'code-barres'))).toBe(true)
  })

  it('keeps a computer on the text search without any barcode tab', async () => {
    const pageHtml = await fetchAddPage({ 'user-agent': desktopUserAgent, 'sec-ch-ua-mobile': '?0' })

    expect(findTabButton(pageHtml, 'code-barres')).toBeUndefined()
    expect(pageHtml).not.toContain('Code-barres')
    expect(pageHtml).toContain('Le scan par code-barres et par photo se fait depuis l’iPhone.')
  })
})
