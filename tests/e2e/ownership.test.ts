import { startEndToEndServer, $fetch, fetch } from '../support/end-to-end-server.ts'
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
  await startEndToEndServer(databaseUrl)

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
    expect((await duplicateResponse.json()).statusMessage).toBe('Un emplacement porte déjà ce nom')
    expect(emptyResponse.status).toBe(422)
  })

  it('answers 409 with a French message, never 500, when the same label is created concurrently', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)

    const concurrentResponses = await Promise.all(Array.from({ length: 6 }, () =>
      sendJson('/api/locations', 'POST', firstCookie, { label: 'Grenier' })))

    const statuses = concurrentResponses.map(response => response.status)
    const conflictMessages = await Promise.all(concurrentResponses
      .filter(response => response.status === 409)
      .map(async response => (await response.json()).statusMessage))
    expect(statuses.filter(status => status === 200)).toHaveLength(1)
    expect(statuses.filter(status => status === 409)).toHaveLength(5)
    expect(new Set(conflictMessages)).toEqual(new Set(['Un emplacement porte déjà ce nom']))
  })

  it('answers 409 with a French message when a person still referenced by a debt is deleted', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)
    const person = await $fetch<{ id: string }>('/api/persons', { method: 'POST', body: { name: 'Dominique' }, headers: { cookie: firstCookie } })
    await $fetch('/api/debts', {
      method: 'POST',
      body: { personId: person.id, amountCents: 500, direction: 'i-owe', reason: 'Avance', createdOn: '2026-11-02' },
      headers: { cookie: firstCookie },
    })

    const response = await sendJson(`/api/persons/${person.id}`, 'DELETE', firstCookie)

    expect(response.status).toBe(409)
    expect((await response.json()).statusMessage).toBe('Cette personne est liée à une dette ou à une vente')
  })

  it('answers 404 on an identifier that is not a uuid', async () => {
    const firstCookie = await logIn('first@example.com', firstPassword)

    const response = await sendJson('/api/locations/not-a-uuid', 'GET', firstCookie)

    expect(response.status).toBe(404)
  })
})
