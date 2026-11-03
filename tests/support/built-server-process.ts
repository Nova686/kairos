import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const builtServerEntryPath = fileURLToPath(new URL('../../.output/server/index.mjs', import.meta.url))

export const commandLineRunsServerEntry = (rawCommandLine: string, serverEntryPath: string): boolean =>
  rawCommandLine.split('\0').includes(serverEntryPath)

export const isBuiltServerProcess = (pid: number): boolean => {
  try {
    return commandLineRunsServerEntry(readFileSync(`/proc/${pid}/cmdline`, 'utf8'), builtServerEntryPath)
  } catch {
    return false
  }
}
