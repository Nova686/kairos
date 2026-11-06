const computerViewportMinimumWidth = 960

const mobileClientHintValue = '?1'

const phoneUserAgentPattern = /iPhone|Android|Mobi/i

export interface CameraScanEnvironment {
  coarsePointer: boolean
  viewportWidth: number
}

export interface CameraScanRequest {
  mobileClientHint: string | undefined
  userAgent: string | undefined
}

export const canUseCameraScan = (environment: CameraScanEnvironment): boolean =>
  environment.coarsePointer || environment.viewportWidth < computerViewportMinimumWidth

export const guessCameraScanFromRequest = (request: CameraScanRequest): boolean =>
  request.mobileClientHint?.trim() === mobileClientHintValue || phoneUserAgentPattern.test(request.userAgent ?? '')
