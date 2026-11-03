import { titleRuleChangesSchema } from '../../../../shared/prices/condition-mapping-schemas'
import {
  ConditionMappingConditionNotAllowedError,
  DuplicateTitleRuleError,
  updateTitleRule,
} from '../../../domain/prices/condition-mappings-store'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const titleRuleChanges = await readBodyOr422(event, titleRuleChangesSchema)
  return updateTitleRule(await useDatabase(), sessionUser.id, getRouterParam(event, 'id') ?? '', titleRuleChanges)
    .catch((failure: unknown) =>
      rethrowAsConflict(failure, [ConditionMappingConditionNotAllowedError, DuplicateTitleRuleError]))
})
