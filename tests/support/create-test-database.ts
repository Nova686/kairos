import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { inject, onTestFinished } from 'vitest'
import { wrapPgliteClient, type KairosDatabase } from '../../server/database/open-database.ts'

let templateDump: Blob | null = null

const templateDumpOfThisRun = (): Blob => {
  templateDump ??= new Blob([readFileSync(inject('testDatabaseTemplatePath'))])
  return templateDump
}

export const createTestDatabase = async (): Promise<KairosDatabase> => {
  const pglite = await PGlite.create({ loadDataDir: templateDumpOfThisRun() })
  onTestFinished(() => pglite.close())
  return wrapPgliteClient(pglite)
}
