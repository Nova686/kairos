import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { logIn, seedAccounts } from '../support/end-to-end-accounts.ts'

const firstPassword = 'first-user-password'
const secondPassword = 'second-user-password'

const sendJson = (path: string, method: string, cookie: string, body?: unknown) =>
  fetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie },
  })

describe('debts API', async () => {
  const databaseUrl = await seedAccounts([
    { email: 'first@example.com', displayName: 'First', password: firstPassword, isAdmin: false },
    { email: 'second@example.com', displayName: 'Second', password: secondPassword, isAdmin: false },
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
    expect((await fetch('/api/debts')).status).toBe(401)
    expect((await fetch('/api/debts/balances')).status).toBe(401)
  })

  it('creates, lists, settles and deletes debts scoped to their owner', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    const person = await $fetch<{ id: string }>('/api/persons', {
      method: 'POST',
      body: { name: 'Camille' },
      headers: { cookie: firstCookie },
    })
    const openDebt = await $fetch<{ id: string }>('/api/debts', {
      method: 'POST',
      body: { personId: person.id, amountCents: 2000, direction: 'owed-to-me', reason: 'Vente', createdOn: '2026-11-02' },
      headers: { cookie: firstCookie },
    })
    const debtToDelete = await $fetch<{ id: string }>('/api/debts', {
      method: 'POST',
      body: { personId: person.id, amountCents: 500, direction: 'i-owe', reason: 'Avance', createdOn: '2026-11-02' },
      headers: { cookie: firstCookie },
    })

    const invalidBody = await sendJson('/api/debts', 'POST', firstCookie, { personId: person.id, amountCents: 0 })
    const foreignPersonDebt = await sendJson('/api/debts', 'POST', secondCookie, {
      personId: person.id,
      amountCents: 100,
      direction: 'i-owe',
      reason: 'x',
      createdOn: '2026-11-02',
    })
    const foreignSettle = await sendJson(`/api/debts/${openDebt.id}/settle`, 'POST', secondCookie, { settledOn: '2026-11-05' })
    const foreignDelete = await sendJson(`/api/debts/${openDebt.id}`, 'DELETE', secondCookie)
    const invalidFilter = await sendJson('/api/debts?settled=maybe', 'GET', firstCookie)
    const balances = await $fetch<{ balanceCents: number }[]>('/api/debts/balances', { headers: { cookie: firstCookie } })
    const deletion = await sendJson(`/api/debts/${debtToDelete.id}`, 'DELETE', firstCookie)
    await $fetch(`/api/debts/${openDebt.id}/settle`, {
      method: 'POST',
      body: { settledOn: '2026-11-05' },
      headers: { cookie: firstCookie },
    })
    const settledAgain = await sendJson(`/api/debts/${openDebt.id}/settle`, 'POST', firstCookie, { settledOn: '2026-11-06' })
    const deleteSettled = await sendJson(`/api/debts/${openDebt.id}`, 'DELETE', firstCookie)
    const settledDebts = await $fetch<unknown[]>('/api/debts?settled=true', { headers: { cookie: firstCookie } })
    const openDebts = await $fetch<unknown[]>('/api/debts?settled=false', { headers: { cookie: firstCookie } })
    const foreignDebts = await $fetch<unknown[]>('/api/debts', { headers: { cookie: secondCookie } })

    expect(invalidBody.status).toBe(422)
    expect(foreignPersonDebt.status).toBe(404)
    expect(foreignSettle.status).toBe(404)
    expect(foreignDelete.status).toBe(404)
    expect(invalidFilter.status).toBe(422)
    expect(balances.map(balance => balance.balanceCents)).toEqual([1500])
    expect(deletion.status).toBe(204)
    expect(settledAgain.status).toBe(409)
    expect(deleteSettled.status).toBe(409)
    expect(settledDebts).toHaveLength(1)
    expect(openDebts).toEqual([])
    expect(foreignDebts).toEqual([])
  })
})
