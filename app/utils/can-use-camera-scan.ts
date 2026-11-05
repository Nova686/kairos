const computerViewportMinimumWidth = 960

export interface CameraScanEnvironment {
  coarsePointer: boolean
  viewportWidth: number
  hasMediaDevices: boolean
}

export const canUseCameraScan = (environment: CameraScanEnvironment): boolean =>
  environment.hasMediaDevices && (environment.coarsePointer || environment.viewportWidth < computerViewportMinimumWidth)
