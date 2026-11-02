import { toggleDrawerState } from '../../../app/utils/toggle-drawer-state.ts'

describe('toggleDrawerState', () => {
  it('opens a drawer that is closed by default on a phone', () => {
    expect(toggleDrawerState(undefined, true)).toBe(true)
  })

  it('closes a drawer that is open by default on desktop', () => {
    expect(toggleDrawerState(undefined, false)).toBe(false)
  })

  it('inverts an explicit state', () => {
    expect(toggleDrawerState(true, true)).toBe(false)
    expect(toggleDrawerState(false, false)).toBe(true)
  })
})
