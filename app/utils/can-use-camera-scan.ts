const computerViewportMinimumWidth = 960

export interface CameraScanEnvironment {
  coarsePointer: boolean
  viewportWidth: number
}

export const canUseCameraScan = (environment: CameraScanEnvironment): boolean =>
  environment.coarsePointer || environment.viewportWidth < computerViewportMinimumWidth
