import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $fetch as baseFetch } from 'ofetch'

export const endToEndAppSecret = 'kairos-end-to-end-app-secret-1234567890'

const builtServerEntry = fileURLToPath(new URL('../../.output/server/index.mjs', import.meta.url))
const startupTimeoutMs = 60000

let serverOrigin = ''
let serverProcess: ChildProcess | undefined

const findFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      probe.close(() => resolve(port))
    })
  })

const waitUntilListening = (child: ChildProcess): Promise<void> =>
  new Promise((resolve, reject) => {
    const startupTimer = setTimeout(() => reject(new Error('Kairos end-to-end server did not start in time')), startupTimeoutMs)
    let output = ''
    const onOutput = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('Listening')) {
        clearTimeout(startupTimer)
        resolve()
      }
    }
    child.stdout?.on('data', onOutput)
    child.stderr?.on('data', onOutput)
    child.once('exit', (exitCode) => {
      clearTimeout(startupTimer)
      reject(new Error(`Kairos end-to-end server exited with code ${exitCode}\n${output}`))
    })
  })

export const startEndToEndServer = async (databaseUrl?: string): Promise<void> => {
  const port = await findFreePort()
  const resolvedDatabaseUrl = databaseUrl ?? `pglite://${join(mkdtempSync(join(tmpdir(), 'kairos-e2e-')), 'database')}`
  serverProcess = spawn(process.execPath, [builtServerEntry], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NUXT_DATABASE_URL: resolvedDatabaseUrl,
      NUXT_APP_SECRET: endToEndAppSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverOrigin = `http://127.0.0.1:${port}`
  await waitUntilListening(serverProcess)
  afterAll(() => {
    serverProcess?.kill('SIGTERM')
  })
}

export const fetch = (path: string, init?: RequestInit): Promise<Response> =>
  globalThis.fetch(new URL(path, serverOrigin), init)

export const $fetch = <ResponseBody = unknown>(path: string, options?: Parameters<typeof baseFetch>[1]): Promise<ResponseBody> =>
  baseFetch<ResponseBody>(path, { baseURL: serverOrigin, ...options } as Parameters<typeof baseFetch<ResponseBody>>[1])
