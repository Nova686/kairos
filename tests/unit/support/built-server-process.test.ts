import { commandLineRunsServerEntry } from '../../support/built-server-process.ts'

const entryPath = '/work/kairos/.output/server/index.mjs'

describe('commandLineRunsServerEntry', () => {
  it('recognises a node process started on exactly this server entry', () => {
    expect(commandLineRunsServerEntry(`/usr/bin/node\0${entryPath}\0`, entryPath)).toBe(true)
  })

  it('ignores the same suffix in another directory', () => {
    expect(commandLineRunsServerEntry('/usr/bin/node\0/work/other-app/.output/server/index.mjs\0', entryPath)).toBe(false)
  })

  it('ignores a path that merely contains this entry path', () => {
    expect(commandLineRunsServerEntry(`/usr/bin/node\0/prefix${entryPath}\0`, entryPath)).toBe(false)
  })

  it('ignores an empty command line', () => {
    expect(commandLineRunsServerEntry('', entryPath)).toBe(false)
  })
})
