import { describeProbeFailure, keepProbeSample, summarizeProbe } from '../../src/probe/summarize-probe.ts'
import type { ProbeOutcome } from '../../src/probe/summarize-probe.ts'
import { SourceBlockedError, SourceDisabledError } from '../../src/price-sources/price-source-types.ts'

const outcome = (overrides: Partial<ProbeOutcome>): ProbeOutcome => ({
  source: 'ebay',
  reference: 'ETB',
  status: 'ok',
  reason: null,
  resultCount: 0,
  durationMs: 10,
  sample: [],
  ...overrides,
})

describe('describeProbeFailure', () => {
  it('classifies a missing key as disabled', () => {
    expect(describeProbeFailure(new SourceDisabledError('ebay', 'EBAY_CLIENT_ID'))).toEqual({ status: 'disabled', reason: 'EBAY_CLIENT_ID' })
  })

  it('classifies a refusal as blocked', () => {
    expect(describeProbeFailure(new SourceBlockedError('upcitemdb', 'http-429'))).toEqual({ status: 'blocked', reason: 'http-429' })
  })

  it('classifies anything else as an error', () => {
    expect(describeProbeFailure(new Error('boom'))).toEqual({ status: 'error', reason: 'boom' })
  })
})

describe('summarizeProbe', () => {
  it('counts each status per source and an empty success as ok', () => {
    const summary = summarizeProbe([
      outcome({ status: 'ok', resultCount: 0 }),
      outcome({ status: 'blocked', reason: 'http-403' }),
      outcome({ status: 'disabled', reason: 'EBAY_CLIENT_ID' }),
      outcome({ source: 'tcgdex', status: 'error', reason: 'boom' }),
    ])
    expect(summary).toEqual([
      { source: 'ebay', okCount: 1, disabledCount: 1, blockedCount: 1, errorCount: 0 },
      { source: 'tcgdex', okCount: 0, disabledCount: 0, blockedCount: 0, errorCount: 1 },
    ])
  })
})

describe('keepProbeSample', () => {
  it('keeps at most three results', () => {
    expect(keepProbeSample([1, 2, 3, 4, 5])).toEqual([1, 2, 3])
  })
})
