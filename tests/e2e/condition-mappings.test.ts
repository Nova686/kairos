import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const memberPassword = 'member-password-123'

const sendJson = (path: string, method: string, cookie: string, body?: unknown) =>
  fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('condition mappings API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'member@example.com', displayName: 'Member', password: memberPassword, isAdmin: false },
  ])
  await startEndToEndServer(databaseUrl)

  it('answers 401 without a session', async () => {
    expect((await fetch('/api/condition-mappings')).status).toBe(401)
  })

  it('serves the seeded mappings and rules to any member', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const response = await $fetch<{ mappings: unknown[], rules: unknown[] }>('/api/condition-mappings', {
      headers: { cookie },
    })
    expect(response.mappings).toHaveLength(15)
    expect(response.rules).toHaveLength(3)
  })

  it('renders the settings page with the seeded rules and their conditions in French', async () => {
    const cookie = await logIn('member@example.com', memberPassword)

    const settingsPage = await fetch('/reglages/correspondances', { headers: { cookie } })
    const settingsPageHtml = await settingsPage.text()

    expect(settingsPage.status).toBe(200)
    expect(settingsPageHtml).toContain('ouvert incomplet · priorité 30')
  })

  it('edits a mapping, rejects a condition outside the scale and a rule without keywords', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const edit = await sendJson('/api/condition-mappings', 'PUT', cookie, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'satisfactory',
    })
    const outsideScale = await sendJson('/api/condition-mappings', 'PUT', cookie, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'sealed-new',
    })
    const ruleWithoutKeywords = await sendJson('/api/condition-mappings/title-rules', 'POST', cookie, {
      category: 'toy', keywords: [], kairosCondition: 'good', priority: 1,
    })
    expect(edit.status).toBe(200)
    expect(outsideScale.status).toBe(422)
    expect(ruleWithoutKeywords.status).toBe(422)
  })

  it('deletes a title rule and answers 404 for an unknown one', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const createdRule = await $fetch<{ id: string }>('/api/condition-mappings/title-rules', {
      method: 'POST',
      body: { category: 'toy', keywords: ['neuf'], kairosCondition: 'new-with-tags', priority: 1 },
      headers: { cookie },
    })
    expect((await sendJson(`/api/condition-mappings/title-rules/${createdRule.id}`, 'DELETE', cookie)).status).toBe(204)
    expect((await sendJson(`/api/condition-mappings/title-rules/${createdRule.id}`, 'DELETE', cookie)).status).toBe(404)
  })

  it('answers 409 for a second rule with the same category and keywords', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const rule = { category: 'makeup', keywords: ['entamé'], kairosCondition: 'good', priority: 1 }
    const first = await sendJson('/api/condition-mappings/title-rules', 'POST', cookie, rule)
    const duplicate = await sendJson('/api/condition-mappings/title-rules', 'POST', cookie, { ...rule, keywords: ['ENTAME'] })
    expect(first.status).toBe(200)
    expect(duplicate.status).toBe(409)
  })

  it('answers 422 for a patch mixing a category and a condition of another scale', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const createdRule = await $fetch<{ id: string }>('/api/condition-mappings/title-rules', {
      method: 'POST',
      body: { category: 'toy', keywords: ['scellé'], kairosCondition: 'new-with-tags', priority: 1 },
      headers: { cookie },
    })
    const mixedPatch = await sendJson(`/api/condition-mappings/title-rules/${createdRule.id}`, 'PATCH', cookie, {
      category: 'toy', kairosCondition: 'sealed-new',
    })
    expect(mixedPatch.status).toBe(422)
  })
})
