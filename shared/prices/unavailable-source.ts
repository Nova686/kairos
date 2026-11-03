export type UnavailabilityKind = 'missing-key' | 'blocked' | 'error'

export type UnavailableSource = { source: string; kind: UnavailabilityKind; reason: string }
