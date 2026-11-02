export const toggleDrawerState = (currentState: boolean | undefined, isMobile: boolean): boolean =>
  !(currentState ?? !isMobile)
