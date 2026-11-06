import { readRequiredSetting, requestSourceJson } from '../../src/source-http/request-source-json.ts'
import { SourceBlockedError, SourceDisabledError } from '../../src/price-sources/price-source-types.ts'
import type { FetchFunction } from '../../src/source-http/request-source-json.ts'

const answerWith = (status: number, body: unknown = {}): FetchFunction =>
  async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('requestSourceJson', () => {
  it('returns the parsed body of a successful answer', async () => {
    const answer = await requestSourceJson<{ total: number }>('upcitemdb', 'https://example.test/a', {}, answerWith(200, { total: 3 }))
    expect(answer).toEqual({ total: 3 })
  })

  it('returns null when the resource does not exist', async () => {
    expect(await requestSourceJson('tcgdex', 'https://example.test/b', {}, answerWith(404))).toBeNull()
  })

  it.each([401, 403, 429])('reports a block on HTTP %i', async (status) => {
    const failure = await requestSourceJson('ebay', 'https://example.test/c', {}, answerWith(status)).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SourceBlockedError)
    expect(failure).toMatchObject({ reason: `http-${status}` })
  })

  it('reports any other failure as a plain error carrying the status', async () => {
    const failure = await requestSourceJson('cardmarket', 'https://example.test/d', {}, answerWith(500)).catch((error: unknown) => error)
    expect(failure).not.toBeInstanceOf(SourceBlockedError)
    expect((failure as Error).message).toMatch(/500/)
  })
})

describe('readRequiredSetting', () => {
  it('disables the source when its setting is missing', () => {
    delete process.env.KAIROS_TEST_MISSING_SETTING
    expect(() => readRequiredSetting('ebay', 'KAIROS_TEST_MISSING_SETTING')).toThrow(SourceDisabledError)
  })

  it('returns the setting when present', () => {
    process.env.KAIROS_TEST_PRESENT_SETTING = 'abc'
    expect(readRequiredSetting('psa', 'KAIROS_TEST_PRESENT_SETTING')).toBe('abc')
  })
})
