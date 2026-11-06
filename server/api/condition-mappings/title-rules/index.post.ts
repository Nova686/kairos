import { titleRuleDraftSchema } from '../../../../shared/prices/condition-mapping-schemas'
import {
  ConditionMappingConditionNotAllowedError,
  DuplicateTitleRuleError,
  createTitleRule,
} from '../../../domain/prices/condition-mappings-store'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const titleRuleDraft = await readBodyOr422(event, titleRuleDraftSchema)
  return createTitleRule(await useDatabase(), sessionUser.id, titleRuleDraft)
    .catch((failure: unknown) =>
      rethrowAsConflict(failure, [ConditionMappingConditionNotAllowedError, DuplicateTitleRuleError]))
})
