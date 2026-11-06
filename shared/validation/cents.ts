import { z } from 'zod'

export const maximumCents = 2_147_483_647

export const nonNegativeCentsSchema = z.number().int().min(0).max(maximumCents)

export const positiveCentsSchema = z.number().int().positive().max(maximumCents)

export const isNonNegativeCents = (cents: number): boolean => nonNegativeCentsSchema.safeParse(cents).success
