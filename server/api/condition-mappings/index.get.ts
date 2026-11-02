import { listConditionMappings } from '../../domain/prices/condition-mappings-store'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return listConditionMappings(await useDatabase())
})
