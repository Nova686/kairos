import { createExclusiveRunner } from '../../../app/utils/run-exclusively.ts'

describe('createExclusiveRunner', () => {
  it('ignores a second call while the first is pending and accepts one afterwards', async () => {
    const runExclusively = createExclusiveRunner()
    let releaseFirstTask: () => void = () => {}
    let startedTaskCount = 0
    const firstTask = () => new Promise<string>((resolve) => {
      startedTaskCount += 1
      releaseFirstTask = () => resolve('first')
    })

    const firstRun = runExclusively(firstTask)
    const secondRun = await runExclusively(async () => {
      startedTaskCount += 1
      return 'second'
    })
    releaseFirstTask()

    expect(secondRun).toBeUndefined()
    expect(await firstRun).toBe('first')
    expect(await runExclusively(async () => 'third')).toBe('third')
    expect(startedTaskCount).toBe(1)
  })

  it('releases after a failing task', async () => {
    const runExclusively = createExclusiveRunner()

    await expect(runExclusively(async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')

    expect(await runExclusively(async () => 'after')).toBe('after')
  })
})
