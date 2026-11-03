import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export default (): void => {
  const buildOutcome = spawnSync('npx', ['nuxt', 'build'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  })
  if (buildOutcome.status !== 0) {
    throw new Error('Building the Nuxt app for the end-to-end tests failed')
  }
}
