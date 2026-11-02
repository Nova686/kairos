import { SourceBlockedError, SourceDisabledError } from '../price-sources/price-source-types.ts'
import type { SourceId } from '../price-sources/price-source-types.ts'

export type ProbeStatus = 'ok' | 'disabled' | 'blocked' | 'error'

export interface ProbeOutcome {
  source: SourceId
  reference: string
  status: ProbeStatus
  reason: string | null
  resultCount: number
  durationMs: number
  sample: unknown[]
}

export interface ProbeSourceSummary {
  source: SourceId
  okCount: number
  disabledCount: number
  blockedCount: number
  errorCount: number
}

const maximumSampleSize = 3

export const keepProbeSample = <T>(results: T[]): T[] => results.slice(0, maximumSampleSize)

export const describeProbeFailure = (failure: unknown): { status: Exclude<ProbeStatus, 'ok'>; reason: string } => {
  if (failure instanceof SourceDisabledError) {
    return { status: 'disabled', reason: failure.missingSetting }
  }
  if (failure instanceof SourceBlockedError) {
    return { status: 'blocked', reason: failure.reason }
  }
  const causeCode = (failure as { cause?: { code?: string } })?.cause?.code
  const message = failure instanceof Error ? failure.message : String(failure)
  return { status: 'error', reason: causeCode ? `${message} (${causeCode})` : message }
}

export const summarizeProbe = (outcomes: ProbeOutcome[]): ProbeSourceSummary[] => {
  const summaryBySource = new Map<SourceId, ProbeSourceSummary>()
  for (const probeOutcome of outcomes) {
    const sourceSummary = summaryBySource.get(probeOutcome.source) ?? {
      source: probeOutcome.source,
      okCount: 0,
      disabledCount: 0,
      blockedCount: 0,
      errorCount: 0,
    }
    sourceSummary[`${probeOutcome.status}Count`] += 1
    summaryBySource.set(probeOutcome.source, sourceSummary)
  }
  return [...summaryBySource.values()]
}
