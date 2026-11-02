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

describe('ownership of locations and persons', async () => {
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

  it('answers 401 on locations without a session', async () => {
    const response = await fetch('/api/locations')

    expect(response.status).toBe(401)
  })

  it('answers 404 and leaves the row untouched when another user patches or deletes a location', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    const createdLocation = await $fetch<{ id: string }>('/api/locations', {
      method: 'POST',
      body: { label: 'Cave' },
      headers: { cookie: firstCookie },
    })

    const patchResponse = await sendJson(`/api/locations/${createdLocation.id}`, 'PATCH', secondCookie, {
      label: 'Volée',
    })
    const getResponse = await sendJson(`/api/locations/${createdLocation.id}`, 'GET', secondCookie)
    const deleteResponse = await sendJson(`/api/locations/${createdLocation.id}`, 'DELETE', secondCookie)

    const firstUserLocations = await $fetch<{ label: string }[]>('/api/locations', { headers: { cookie: firstCookie } })
    expect(patchResponse.status).toBe(404)
    expect(getResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
    expect(firstUserLocations.map(location => location.label)).toEqual(['Cave'])
  })

  it('does not list the rows of another user', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    await $fetch('/api/persons', { method: 'POST', body: { name: 'Camille' }, headers: { cookie: firstCookie } })

    const secondUserLocations = await $fetch<unknown[]>('/api/locations', { headers: { cookie: secondCookie } })
    const secondUserPersons = await $fetch<unknown[]>('/api/persons', { headers: { cookie: secondCookie } })

    expect(secondUserLocations).toEqual([])
    expect(secondUserPersons).toEqual([])
  })

  it('answers 404 when another user renames a person', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const secondCookie = await logIn('second@example.com', secondPassword)
    const [firstUserPerson] = await $fetch<{ id: string }[]>('/api/persons', { headers: { cookie: firstCookie } })

    const response = await sendJson(`/api/persons/${firstUserPerson!.id}`, 'PATCH', secondCookie, { name: 'Volée' })

    expect(response.status).toBe(404)
  })

  it('answers 409 on a duplicate location label and 422 on an empty one', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)

    const duplicateResponse = await sendJson('/api/locations', 'POST', firstCookie, { label: 'Cave' })
    const emptyResponse = await sendJson('/api/locations', 'POST', firstCookie, { label: '  ' })

    expect(duplicateResponse.status).toBe(409)
    expect(emptyResponse.status).toBe(422)
  })

  it('answers 404 on an identifier that is not a uuid', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)

    const response = await sendJson('/api/locations/not-a-uuid', 'GET', firstCookie)

    expect(response.status).toBe(404)
  })
})
