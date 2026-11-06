import { z } from 'zod'

export const personBodySchema = z.object({ name: z.string().trim().min(1) })
