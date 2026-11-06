type ErrorClass = abstract new (...parameters: never[]) => Error

export const rethrowAsConflict = (failure: unknown, conflictErrorClasses: ErrorClass[]): never => {
  if (conflictErrorClasses.some(conflictErrorClass => failure instanceof conflictErrorClass)) {
    throw createError({ statusCode: 409, statusMessage: (failure as Error).message })
  }
  throw failure
}
