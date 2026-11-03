import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $fetch as baseFetch } from 'ofetch'

export const endToEndAppSecret = 'kairos-end-to-end-app-secret-1234567890'

const builtServerEntry = fileURLToPath(new URL('../../.output/server/index.mjs', import.meta.url))
const startupTimeoutMs = 60000

const serverPidDirectoryVariable = 'KAIROS_E2E_SERVER_PID_DIRECTORY'
const pgliteUrlPrefix = 'pglite://'
const gracefulStopMs = 3000

let serverOrigin = ''

const stopServer = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()))
  child.kill('SIGTERM')
  const forcedStop = setTimeout(() => child.kill('SIGKILL'), gracefulStopMs)
  await exited
  clearTimeout(forcedStop)
}

const waitUntilListening = (child: ChildProcess): Promise<number> =>
  new Promise((resolve, reject) => {
    let output = ''
    const startupTimer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Kairos end-to-end server did not start in time\n${output}`))
    }, startupTimeoutMs)
    const onOutput = (chunk: Buffer) => {
      output += chunk.toString()
      const bound = /Listening on:?\s+https?:\/\/[^\s:]+:(\d+)/.exec(output)
      if (bound?.[1]) {
        clearTimeout(startupTimer)
        resolve(Number(bound[1]))
      }
    }
    child.stdout?.on('data', onOutput)
    child.stderr?.on('data', onOutput)
    child.once('exit', (exitCode) => {
      clearTimeout(startupTimer)
      reject(new Error(`Kairos end-to-end server exited with code ${exitCode}\n${output}`))
    })
  })

const recordServerPid = (child: ChildProcess): void => {
  const pidDirectory = process.env[serverPidDirectoryVariable]
  if (pidDirectory && child.pid !== undefined) {
    writeFileSync(join(pidDirectory, String(child.pid)), '')
  }
}

export const startEndToEndServer = async (databaseUrl?: string): Promise<void> => {
  const resolvedDatabaseUrl = databaseUrl ?? `${pgliteUrlPrefix}${join(mkdtempSync(join(tmpdir(), 'kairos-e2e-')), 'database')}`
  const child = spawn(process.execPath, [builtServerEntry], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
      NUXT_DATABASE_URL: resolvedDatabaseUrl,
      NUXT_APP_SECRET: endToEndAppSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  recordServerPid(child)
  const killOnWorkerExit = () => child.kill('SIGKILL')
  process.once('exit', killOnWorkerExit)
  afterAll(async () => {
    await stopServer(child)
    process.off('exit', killOnWorkerExit)
    if (resolvedDatabaseUrl.startsWith(pgliteUrlPrefix)) {
      rmSync(dirname(resolvedDatabaseUrl.slice(pgliteUrlPrefix.length)), { recursive: true, force: true })
    }
  })
  serverOrigin = `http://127.0.0.1:${await waitUntilListening(child)}`
}

export const fetch = (path: string, init?: RequestInit): Promise<Response> =>
  globalThis.fetch(new URL(path, serverOrigin), init)

export const $fetch = <ResponseBody = unknown>(path: string, options?: Parameters<typeof baseFetch>[1]): Promise<ResponseBody> =>
  baseFetch<ResponseBody>(path, { baseURL: serverOrigin, ...options } as Parameters<typeof baseFetch<ResponseBody>>[1])
