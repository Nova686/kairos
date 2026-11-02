import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

export const readBodyOr422 = async <TBody>(event: H3Event, bodySchema: ZodType<TBody>): Promise<TBody> => {
  const parsedBody = bodySchema.safeParse(await readBody(event))
  if (!parsedBody.success) {
    throw createError({ statusCode: 422, statusMessage: 'Corps de requête invalide' })
  }
  return parsedBody.data
}
