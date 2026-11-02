export const createExclusiveRunner = () => {
  let isRunning = false

  return async <TOutcome>(task: () => Promise<TOutcome>): Promise<TOutcome | undefined> => {
    if (isRunning) {
      return undefined
    }
    isRunning = true
    try {
      return await task()
    }
    finally {
      isRunning = false
    }
  }
}
