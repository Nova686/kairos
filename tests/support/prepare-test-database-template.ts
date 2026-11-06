import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { TestProject } from 'vitest/node'
import { prepareDatabaseOnPglite } from '../../server/database/open-database.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseTemplatePath: string
  }
}

export default async (project: TestProject): Promise<() => void> => {
  const templateFolder = mkdtempSync(join(tmpdir(), 'kairos-test-template-'))
  const templatePath = join(templateFolder, 'template.tar')
  const template = new PGlite()
  await prepareDatabaseOnPglite(template)
  const dump = await template.dumpDataDir('none')
  writeFileSync(templatePath, Buffer.from(await dump.arrayBuffer()))
  await template.close()
  project.provide('testDatabaseTemplatePath', templatePath)
  return () => rmSync(templateFolder, { recursive: true, force: true })
}
