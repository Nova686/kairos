import { createInterface } from 'node:readline/promises'
import { openDatabase } from '../server/database/open-database.ts'
import { createUser } from '../server/domain/accounts/accounts-service.ts'
import { scryptPasswordHasher } from '../server/domain/accounts/scrypt-password-hasher.ts'

const defaultDatabaseUrl = 'pglite://.data/kairos'

const readPasswordFromStandardInput = async (): Promise<string> => {
  if (process.stdin.isTTY) {
    process.stdout.write('Mot de passe : ')
    const typedCharacters: string[] = []
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    return new Promise((resolvePassword) => {
      const onKeypress = (keypress: string) => {
        if (keypress === '\r' || keypress === '\n') {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off('data', onKeypress)
          process.stdout.write('\n')
          resolvePassword(typedCharacters.join(''))
        }
        else if (keypress === '\u0003') {
          process.exit(130)
        }
        else if (keypress === '\u007f') {
          typedCharacters.pop()
        }
        else {
          typedCharacters.push(keypress)
        }
      }
      process.stdin.on('data', onKeypress)
    })
  }
  const lines = createInterface({ input: process.stdin })
  for await (const line of lines) {
    lines.close()
    return line
  }
  return ''
}

const [email, displayName] = process.argv.slice(2)
if (!email || !displayName) {
  console.error('Usage : npm run create-admin -- <email> <displayName>')
  process.exit(1)
}

const password = await readPasswordFromStandardInput()
const database = await openDatabase(process.env.NUXT_DATABASE_URL ?? defaultDatabaseUrl)
const administrator = await createUser(database, { email, displayName, password, isAdmin: true }, scryptPasswordHasher)
console.log(`Administrateur créé : ${administrator.email}`)
process.exit(0)
