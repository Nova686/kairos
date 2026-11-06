const uniqueViolationSqlState = '23505'
const foreignKeyViolationSqlState = '23503'
const restrictViolationSqlState = '23001'
const maximumCauseDepth = 5

type DriverFailure = { code?: unknown, constraint?: unknown, constraint_name?: unknown, cause?: unknown }

const conflictMessageByConstraintName: Record<string, string> = {
  users_email_unique: 'Cet email est déjà utilisé',
  locations_owner_id_label_unique: 'Un emplacement porte déjà ce nom',
  product_barcodes_pkey: 'Ce code-barres est déjà lié à un autre produit',
  sale_items_stock_item_id_unique: 'Un de ces exemplaires vient d’être vendu',
}

const fallbackConflictMessageBySqlState: Record<string, string> = {
  [uniqueViolationSqlState]: 'Cette donnée existe déjà : rechargez la page',
  [foreignKeyViolationSqlState]: 'Une donnée liée vient de changer : rechargez la page',
  [restrictViolationSqlState]: 'Une donnée liée vient de changer : rechargez la page',
}

const isDriverFailure = (candidate: unknown): candidate is DriverFailure =>
  typeof candidate === 'object' && candidate !== null

const constraintNameOf = (driverFailure: DriverFailure): string | null => {
  const constraintName = driverFailure.constraint_name ?? driverFailure.constraint
  return typeof constraintName === 'string' ? constraintName : null
}

export const describeDatabaseConflict = (failure: unknown): string | null => {
  let candidate = failure
  for (let depth = 0; depth < maximumCauseDepth && isDriverFailure(candidate); depth += 1) {
    const fallbackMessage = typeof candidate.code === 'string' ? fallbackConflictMessageBySqlState[candidate.code] : undefined
    if (fallbackMessage !== undefined) {
      const constraintName = constraintNameOf(candidate)
      return (constraintName === null ? undefined : conflictMessageByConstraintName[constraintName]) ?? fallbackMessage
    }
    candidate = candidate.cause
  }
  return null
}
