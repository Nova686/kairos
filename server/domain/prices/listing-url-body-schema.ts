import { z } from 'zod'

export const listingUrlBodySchema = z.object({ url: z.string().trim().min(1) })
