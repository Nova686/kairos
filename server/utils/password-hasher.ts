import type { PasswordHasher } from '../domain/accounts/accounts-service'

export const nitroPasswordHasher: PasswordHasher = { hashPassword, verifyPassword }
