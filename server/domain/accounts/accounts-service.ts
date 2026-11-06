import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { invitations, users } from '../../database/schema/index.ts'

export type SessionUser = {
  id: string
  email: string
  displayName: string
  isAdmin: boolean
}

export type PasswordHasher = {
  hashPassword: (plainPassword: string) => Promise<string>
  verifyPassword: (hashedPassword: string, plainPassword: string) => Promise<boolean>
}

export type NewAccount = {
  email: string
  displayName: string
  password: string
}

export const minimumPasswordLength = 10
const invitationCodeByteCount = 18
const dummyPasswordByteCount = 18
const invitationValidityInMilliseconds = 7 * 24 * 60 * 60 * 1000

export class InvitationUnavailableError extends Error {
  constructor() {
    super('Invitation unknown, already used or expired')
    this.name = 'InvitationUnavailableError'
  }
}

export class PasswordTooShortError extends Error {
  constructor() {
    super(`Password must contain at least ${minimumPasswordLength} characters`)
    this.name = 'PasswordTooShortError'
  }
}

export class EmailAlreadyUsedError extends Error {
  constructor() {
    super('Email already used')
    this.name = 'EmailAlreadyUsedError'
  }
}

type DatabaseExecutor = Pick<KairosDatabase, 'select' | 'insert' | 'update'>

const dummyPasswordHashByHasher = new WeakMap<PasswordHasher, Promise<string>>()

const dummyPasswordHashOf = (passwordHasher: PasswordHasher): Promise<string> => {
  const knownDummyPasswordHash = dummyPasswordHashByHasher.get(passwordHasher)
  if (knownDummyPasswordHash !== undefined) {
    return knownDummyPasswordHash
  }
  const dummyPasswordHash = passwordHasher.hashPassword(randomBytes(dummyPasswordByteCount).toString('base64url'))
  dummyPasswordHashByHasher.set(passwordHasher, dummyPasswordHash)
  dummyPasswordHash.catch(() => dummyPasswordHashByHasher.delete(passwordHasher))
  return dummyPasswordHash
}

const toSessionUser = (storedUser: typeof users.$inferSelect): SessionUser => ({
  id: storedUser.id,
  email: storedUser.email,
  displayName: storedUser.displayName,
  isAdmin: storedUser.isAdmin,
})

const insertUser = async (
  executor: DatabaseExecutor,
  newAccount: NewAccount & { isAdmin: boolean },
  passwordHasher: PasswordHasher,
): Promise<SessionUser> => {
  if (newAccount.password.length < minimumPasswordLength) {
    throw new PasswordTooShortError()
  }
  const email = newAccount.email.trim().toLowerCase()
  const [existingUser] = await executor.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existingUser) {
    throw new EmailAlreadyUsedError()
  }
  const [insertedUser] = await executor
    .insert(users)
    .values({
      email,
      displayName: newAccount.displayName.trim(),
      passwordHash: await passwordHasher.hashPassword(newAccount.password),
      isAdmin: newAccount.isAdmin,
    })
    .returning()
  return toSessionUser(insertedUser!)
}

export const createUser = (
  database: KairosDatabase,
  newAccount: NewAccount & { isAdmin: boolean },
  passwordHasher: PasswordHasher,
): Promise<SessionUser> => insertUser(database, newAccount, passwordHasher)

export const verifyCredentials = async (
  database: KairosDatabase,
  email: string,
  password: string,
  passwordHasher: PasswordHasher,
): Promise<SessionUser | null> => {
  const [storedUser] = await database.select().from(users).where(eq(users.email, email.trim().toLowerCase()))
  if (!storedUser) {
    await passwordHasher.verifyPassword(await dummyPasswordHashOf(passwordHasher), password)
    return null
  }
  const isPasswordValid = await passwordHasher.verifyPassword(storedUser.passwordHash, password)
  return isPasswordValid ? toSessionUser(storedUser) : null
}

export const createInvitation = async (
  database: KairosDatabase,
  createdByUserId: string,
): Promise<{ code: string; expiresAt: Date }> => {
  const code = randomBytes(invitationCodeByteCount).toString('base64url')
  const expiresAt = new Date(Date.now() + invitationValidityInMilliseconds)
  await database.insert(invitations).values({ code, createdByUserId, expiresAt })
  return { code, expiresAt }
}

export const isInvitationAvailable = async (database: KairosDatabase, code: string): Promise<boolean> => {
  const [availableInvitation] = await database
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.code, code), isNull(invitations.usedAt), gt(invitations.expiresAt, new Date())))
  return availableInvitation !== undefined
}

export const acceptInvitation = (
  database: KairosDatabase,
  code: string,
  newAccount: NewAccount,
  passwordHasher: PasswordHasher,
): Promise<SessionUser> =>
  database.transaction(async (transaction) => {
    const [claimedInvitation] = await transaction
      .update(invitations)
      .set({ usedAt: new Date() })
      .where(and(eq(invitations.code, code), isNull(invitations.usedAt), gt(invitations.expiresAt, new Date())))
      .returning({ id: invitations.id })
    if (!claimedInvitation) {
      throw new InvitationUnavailableError()
    }
    const invitedUser = await insertUser(transaction, { ...newAccount, isAdmin: false }, passwordHasher)
    await transaction
      .update(invitations)
      .set({ usedByUserId: invitedUser.id })
      .where(eq(invitations.id, claimedInvitation.id))
    return invitedUser
  })
