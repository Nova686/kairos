import { conditionMappingDraftSchema } from '../../../shared/prices/condition-mapping-schemas'
import { ConditionMappingConditionNotAllowedError, upsertConditionMapping } from '../../domain/prices/condition-mappings-store'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const conditionMappingDraft = await readBodyOr422(event, conditionMappingDraftSchema)
  return upsertConditionMapping(await useDatabase(), sessionUser.id, conditionMappingDraft)
    .catch((failure: unknown) => rethrowAsConflict(failure, [ConditionMappingConditionNotAllowedError]))
})
