import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverPidDirectoryVariable = 'KAIROS_E2E_SERVER_PID_DIRECTORY'
const pidDirectoryPrefix = 'kairos-e2e-pids-'
const builtServerEntryName = '.output/server/index.mjs'
const gracefulStopMs = 3000

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const sendSignal = (pid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(pid, signal)
  } catch {
    return
  }
}

const stopSurvivingServers = async (pidDirectory: string): Promise<void> => {
  const survivingPids = readdirSync(pidDirectory).map(Number).filter(isAlive)
  survivingPids.forEach(pid => sendSignal(pid, 'SIGTERM'))
  const deadline = Date.now() + gracefulStopMs
  while (survivingPids.some(isAlive) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  survivingPids.filter(isAlive).forEach(pid => sendSignal(pid, 'SIGKILL'))
}

const isKairosServer = (pid: number): boolean => {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(builtServerEntryName)
  } catch {
    return false
  }
}

const stopServersLeftByInterruptedRuns = async (): Promise<void> => {
  const staleDirectories = readdirSync(tmpdir()).filter(name => name.startsWith(pidDirectoryPrefix))
  for (const directoryName of staleDirectories) {
    const staleDirectory = join(tmpdir(), directoryName)
    const leftoverPids = readdirSync(staleDirectory).map(Number).filter(pid => isAlive(pid) && isKairosServer(pid))
    leftoverPids.forEach(pid => sendSignal(pid, 'SIGKILL'))
    rmSync(staleDirectory, { recursive: true, force: true })
  }
}

export default async (): Promise<() => Promise<void>> => {
  await stopServersLeftByInterruptedRuns()
  const buildOutcome = spawnSync('npx', ['nuxt', 'build'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  if (buildOutcome.status !== 0) {
    throw new Error('Building the Nuxt app for the end-to-end tests failed')
  }
  const pidDirectory = mkdtempSync(join(tmpdir(), pidDirectoryPrefix))
  process.env[serverPidDirectoryVariable] = pidDirectory
  return async () => {
    await stopSurvivingServers(pidDirectory)
    rmSync(pidDirectory, { recursive: true, force: true })
  }
}
