import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const backupScriptPath = fileURLToPath(new URL('../../../deploy/backup/backup-database.sh', import.meta.url))

const succeedingPgDump = `#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-f" ]; then
    shift
    printf 'stub dump' > "$1"
  fi
  shift
done
`

const failingPgDump = `#!/bin/sh
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-f" ]; then
    shift
    printf 'half a dump' > "$1"
  fi
  shift
done
exit 1
`

const dumpNamePattern = /^kairos-\d{4}-\d{2}-\d{2}\.dump$/

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true }))
})

const prepareBackupRun = (pgDumpScript: string, existingDumpNames: string[]) => {
  const workingDirectory = mkdtempSync(join(tmpdir(), 'kairos-backup-retention-'))
  temporaryDirectories.push(workingDirectory)
  const backupDirectory = join(workingDirectory, 'backups')
  const stubDirectory = join(workingDirectory, 'bin')
  mkdirSync(backupDirectory)
  mkdirSync(stubDirectory)
  writeFileSync(join(stubDirectory, 'pg_dump'), pgDumpScript)
  chmodSync(join(stubDirectory, 'pg_dump'), 0o755)
  existingDumpNames.forEach(dumpName => writeFileSync(join(backupDirectory, dumpName), 'older dump'))
  const runBackup = () => spawnSync('bash', [backupScriptPath], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${stubDirectory}:${process.env.PATH}`, BACKUP_DIRECTORY: backupDirectory },
  })
  return { backupDirectory, runBackup }
}

const januaryDumpNames = (dayCount: number): string[] =>
  Array.from({ length: dayCount }, (_, dayIndex) => `kairos-2026-01-${String(dayIndex + 1).padStart(2, '0')}.dump`)

describe('backup-database.sh', () => {
  it('writes the dump of the day and keeps only the 14 newest dumps', () => {
    const existingDumpNames = januaryDumpNames(20)
    const { backupDirectory, runBackup } = prepareBackupRun(succeedingPgDump, [...existingDumpNames, 'notes.txt'])

    const backupRun = runBackup()

    const remainingNames = readdirSync(backupDirectory).sort()
    const newDumpNames = remainingNames.filter(name => !existingDumpNames.includes(name) && name !== 'notes.txt')
    expect(backupRun.status, backupRun.stderr).toBe(0)
    expect(newDumpNames).toHaveLength(1)
    expect(newDumpNames[0]).toMatch(dumpNamePattern)
    expect(remainingNames.filter(name => dumpNamePattern.test(name))).toEqual([...existingDumpNames.slice(-13), newDumpNames[0]!].sort())
    expect(remainingNames).toContain('notes.txt')
  })

  it('deletes nothing while fewer than 14 dumps exist', () => {
    const existingDumpNames = januaryDumpNames(5)
    const { backupDirectory, runBackup } = prepareBackupRun(succeedingPgDump, existingDumpNames)

    const backupRun = runBackup()

    expect(backupRun.status, backupRun.stderr).toBe(0)
    expect(readdirSync(backupDirectory).filter(name => dumpNamePattern.test(name))).toHaveLength(6)
  })

  it('keeps every older dump and leaves no partial file when the dump fails', () => {
    const existingDumpNames = januaryDumpNames(20)
    const { backupDirectory, runBackup } = prepareBackupRun(failingPgDump, existingDumpNames)

    const backupRun = runBackup()

    expect(backupRun.status).not.toBe(0)
    expect(readdirSync(backupDirectory).sort()).toEqual(existingDumpNames)
  })
})
