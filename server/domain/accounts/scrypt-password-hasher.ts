import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import type { PasswordHasher } from './accounts-service.ts'

const scryptHash = new Hash(new Scrypt({}))

export const scryptPasswordHasher: PasswordHasher = {
  hashPassword: plainPassword => scryptHash.make(plainPassword),
  verifyPassword: (hashedPassword, plainPassword) => scryptHash.verify(hashedPassword, plainPassword),
}
