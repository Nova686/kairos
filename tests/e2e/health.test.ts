import packageManifest from '../../package.json' with { type: 'json' }
import { endToEndAppSecret, startEndToEndServer, fetch } from '../support/end-to-end-server.ts'

describe('health', async () => {
  await startEndToEndServer()

  it('answers 200 without a session and exposes no secret', async () => {
    const response = await fetch('/api/health')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['status'])
    expect(body).toEqual({ status: 'ok' })
    expect(JSON.stringify(body)).not.toContain(packageManifest.version)
    expect(JSON.stringify(body)).not.toContain(endToEndAppSecret)
  })
})
