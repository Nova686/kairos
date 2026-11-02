import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
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
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    nuxtConfig: {
      runtimeConfig: {
        databaseUrl,
        appSecret: 'kairos-end-to-end-app-secret-1234567890',
      },
    },
  })

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

  it('edits a mapping, rejects a condition outside the scale and an invalid pattern', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const edit = await sendJson('/api/condition-mappings', 'PUT', cookie, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'satisfactory',
    })
    const outsideScale = await sendJson('/api/condition-mappings', 'PUT', cookie, {
      category: 'toy', source: 'ebay', sourceCondition: 'Occasion', kairosCondition: 'sealed-new',
    })
    const invalidPattern = await sendJson('/api/condition-mappings/title-rules', 'POST', cookie, {
      category: 'toy', pattern: '(', kairosCondition: 'good', priority: 1,
    })
    expect(edit.status).toBe(200)
    expect(outsideScale.status).toBe(422)
    expect(invalidPattern.status).toBe(422)
  })

  it('deletes a title rule and answers 404 for an unknown one', async () => {
    const cookie = await logIn('member@example.com', memberPassword)
    const createdRule = await $fetch<{ id: string }>('/api/condition-mappings/title-rules', {
      method: 'POST',
      body: { category: 'toy', pattern: 'neuf', kairosCondition: 'new-with-tags', priority: 1 },
      headers: { cookie },
    })
    expect((await sendJson(`/api/condition-mappings/title-rules/${createdRule.id}`, 'DELETE', cookie)).status).toBe(204)
    expect((await sendJson(`/api/condition-mappings/title-rules/${createdRule.id}`, 'DELETE', cookie)).status).toBe(404)
  })
})
