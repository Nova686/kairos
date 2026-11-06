import { eq } from 'drizzle-orm'
import { invitations, users } from '../../../server/database/schema/index.ts'
import {
  EmailAlreadyUsedError,
  InvitationUnavailableError,
  PasswordTooShortError,
  acceptInvitation,
  createInvitation,
  createUser,
  isAdministrator,
  isInvitationAvailable,
  verifyCredentials,
  type PasswordHasher,
} from '../../../server/domain/accounts/accounts-service.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const fakePasswordHasher: PasswordHasher = {
  hashPassword: async plainPassword => `hashed:${plainPassword}`,
  verifyPassword: async (hashedPassword, plainPassword) => hashedPassword === `hashed:${plainPassword}`,
}

const createAdmin = (database: Awaited<ReturnType<typeof createTestDatabase>>) =>
  createUser(
    database,
    { email: 'Admin@Example.com', displayName: 'Admin', password: 'long-enough-password', isAdmin: true },
    fakePasswordHasher,
  )

describe('accounts service', () => {
  it('creates a user with a lower-cased email and a hashed password', async () => {
    const database = await createTestDatabase()

    const sessionUser = await createAdmin(database)

    expect(sessionUser).toMatchObject({ email: 'admin@example.com', displayName: 'Admin', isAdmin: true })
    const [storedUser] = await database.select().from(users)
    expect(storedUser?.passwordHash).toBe('hashed:long-enough-password')
  })

  it('rejects a password shorter than 10 characters', async () => {
    const database = await createTestDatabase()

    await expect(createUser(
      database,
      { email: 'a@example.com', displayName: 'A', password: 'short', isAdmin: false },
      fakePasswordHasher,
    )).rejects.toBeInstanceOf(PasswordTooShortError)
  })

  it('verifies credentials and answers null on a wrong password or unknown email', async () => {
    const database = await createTestDatabase()
    await createAdmin(database)

    expect(await verifyCredentials(database, 'ADMIN@example.com', 'long-enough-password', fakePasswordHasher))
      .toMatchObject({ email: 'admin@example.com' })
    expect(await verifyCredentials(database, 'admin@example.com', 'wrong-password-here', fakePasswordHasher)).toBeNull()
    expect(await verifyCredentials(database, 'nobody@example.com', 'long-enough-password', fakePasswordHasher)).toBeNull()
  })

  it('spends one password verification on an unknown email so the answer time does not reveal registered emails', async () => {
    const database = await createTestDatabase()
    await createAdmin(database)
    const verifiedHashes: string[] = []
    const recordingPasswordHasher: PasswordHasher = {
      hashPassword: fakePasswordHasher.hashPassword,
      verifyPassword: async (hashedPassword, plainPassword) => {
        verifiedHashes.push(hashedPassword)
        return fakePasswordHasher.verifyPassword(hashedPassword, plainPassword)
      },
    }

    const unknownEmailAnswer = await verifyCredentials(database, 'nobody@example.com', 'long-enough-password', recordingPasswordHasher)
    await verifyCredentials(database, 'nobody@example.com', 'long-enough-password', recordingPasswordHasher)

    expect(unknownEmailAnswer).toBeNull()
    expect(verifiedHashes).toHaveLength(2)
    expect(verifiedHashes[0]).not.toBe('hashed:long-enough-password')
    expect(verifiedHashes[1]).toBe(verifiedHashes[0])
  })

  it('reads administrator rights from the database rather than from the session', async () => {
    const database = await createTestDatabase()
    const admin = await createAdmin(database)
    const member = await createUser(
      database,
      { email: 'member@example.com', displayName: 'Member', password: 'long-enough-password', isAdmin: false },
      fakePasswordHasher,
    )

    const adminBeforeDemotion = await isAdministrator(database, admin.id)
    await database.update(users).set({ isAdmin: false }).where(eq(users.id, admin.id))

    expect(adminBeforeDemotion).toBe(true)
    expect(await isAdministrator(database, admin.id)).toBe(false)
    expect(await isAdministrator(database, member.id)).toBe(false)
    expect(await isAdministrator(database, '00000000-0000-4000-8000-000000000000')).toBe(false)
  })

  it('creates an invitation valid for 7 days with a 24 character URL-safe code', async () => {
    const database = await createTestDatabase()
    const admin = await createAdmin(database)

    const { code, expiresAt } = await createInvitation(database, admin.id)

    expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/)
    const sevenDaysInMilliseconds = 7 * 24 * 60 * 60 * 1000
    expect(Math.abs(expiresAt.getTime() - Date.now() - sevenDaysInMilliseconds)).toBeLessThan(60_000)
  })

  it('accepts a fresh invitation once and marks it used', async () => {
    const database = await createTestDatabase()
    const admin = await createAdmin(database)
    const { code } = await createInvitation(database, admin.id)

    const invitedUser = await acceptInvitation(
      database,
      code,
      { email: 'Guest@Example.com', displayName: 'Guest', password: 'guest-password-1' },
      fakePasswordHasher,
    )

    expect(invitedUser).toMatchObject({ email: 'guest@example.com', isAdmin: false })
    const [storedInvitation] = await database.select().from(invitations).where(eq(invitations.code, code))
    expect(storedInvitation?.usedAt).not.toBeNull()
    expect(storedInvitation?.usedByUserId).toBe(invitedUser.id)
  })

  it('refuses a second acceptance of the same code', async () => {
    const database = await createTestDatabase()
    const admin = await createAdmin(database)
    const { code } = await createInvitation(database, admin.id)
    await acceptInvitation(
      database,
      code,
      { email: 'first@example.com', displayName: 'First', password: 'first-password-1' },
      fakePasswordHasher,
    )

    await expect(acceptInvitation(
      database,
      code,
      { email: 'second@example.com', displayName: 'Second', password: 'second-password-1' },
      fakePasswordHasher,
    )).rejects.toBeInstanceOf(InvitationUnavailableError)

    expect(await database.select().from(users)).toHaveLength(2)
  })

  it('refuses an email already used and leaves the invitation available', async () => {
    const database = await createTestDatabase()
    const admin = await createAdmin(database)
    const { code } = await createInvitation(database, admin.id)

    await expect(acceptInvitation(
      database,
      code,
      { email: 'ADMIN@example.com', displayName: 'Copy', password: 'guest-password-1' },
      fakePasswordHasher,
    )).rejects.toBeInstanceOf(EmailAlreadyUsedError)

    const [storedInvitation] = await database.select().from(invitations).where(eq(invitations.code, code))
    expect(storedInvitation).toMatchObject({ usedAt: null, usedByUserId: null })
    expect(await isInvitationAvailable(database, code)).toBe(true)
  })

  it('refuses an expired or unknown code', async () => {
    const database = await createTestDatabase()
    const admin = await createAdmin(database)
    const { code } = await createInvitation(database, admin.id)
    await database.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.code, code))
    const guest = { email: 'guest@example.com', displayName: 'Guest', password: 'guest-password-1' }

    await expect(acceptInvitation(database, code, guest, fakePasswordHasher)).rejects.toBeInstanceOf(InvitationUnavailableError)
    await expect(acceptInvitation(database, 'unknown', guest, fakePasswordHasher)).rejects.toBeInstanceOf(InvitationUnavailableError)
    expect(await database.select().from(users)).toHaveLength(1)
  })
})
