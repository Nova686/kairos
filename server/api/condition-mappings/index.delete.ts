import { conditionMappingKeySchema } from '../../../shared/prices/condition-mapping-schemas'
import { deleteConditionMapping } from '../../domain/prices/condition-mappings-store'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const parsedKey = conditionMappingKeySchema.safeParse(getQuery(event))
  if (!parsedKey.success) {
    throw createError({ statusCode: 422, statusMessage: 'Paramètres invalides' })
  }
  await deleteConditionMapping(await useDatabase(), sessionUser.id, parsedKey.data)
  setResponseStatus(event, 204)
  return null
})
