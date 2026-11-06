export type SharedSlowLoad<Loaded> = {
  obtain: () => Promise<Loaded>
  release: () => Promise<Loaded> | null
}

const waitAtMost = <Loaded>(loading: Promise<Loaded>, timeoutMs: number, describeTimeout: (timeoutMs: number) => string): Promise<Loaded> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(describeTimeout(timeoutMs))), timeoutMs)
  })
  return Promise.race([loading, timeout]).finally(() => clearTimeout(timer))
}

export const shareSlowLoad = <Loaded>(
  load: () => Promise<Loaded>,
  { timeoutMs, describeTimeout }: { timeoutMs: number, describeTimeout: (timeoutMs: number) => string },
): SharedSlowLoad<Loaded> => {
  let inFlightLoad: Promise<Loaded> | null = null
  return {
    obtain: () => {
      if (inFlightLoad === null) {
        const startedLoad = load()
        inFlightLoad = startedLoad
        startedLoad.catch(() => {
          if (inFlightLoad === startedLoad) {
            inFlightLoad = null
          }
        })
      }
      return waitAtMost(inFlightLoad, timeoutMs, describeTimeout)
    },
    release: () => {
      const releasedLoad = inFlightLoad
      inFlightLoad = null
      return releasedLoad
    },
  }
}
