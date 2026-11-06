import { z } from 'zod'

export const locationBodySchema = z.object({ label: z.string().trim().min(1) })
