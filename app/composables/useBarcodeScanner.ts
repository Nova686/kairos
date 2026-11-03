import { onBeforeUnmount, ref } from 'vue'

export type CameraState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable'

interface ScannerControls {
  stop: () => void
}

const deniedErrorNames = ['NotAllowedError', 'SecurityError', 'PermissionDeniedError']

const vibrationMilliseconds = 50

const stopVideoTracks = (videoElement: HTMLVideoElement | null) => {
  const stream = videoElement?.srcObject as MediaStream | null | undefined
  stream?.getTracks?.().forEach(track => track.stop())
  if (videoElement) {
    videoElement.srcObject = null
  }
}

export const useBarcodeScanner = () => {
  const videoElement = ref<HTMLVideoElement | null>(null)
  const lastCode = ref<string | null>(null)
  const cameraState = ref<CameraState>('idle')
  let activeControls: ScannerControls | null = null
  let startGeneration = 0

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      stop()
    }
  }

  const stop = () => {
    startGeneration += 1
    activeControls?.stop()
    activeControls = null
    stopVideoTracks(videoElement.value)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (cameraState.value === 'starting' || cameraState.value === 'scanning') {
      cameraState.value = 'idle'
    }
  }

  const start = async (): Promise<void> => {
    if (cameraState.value === 'starting' || cameraState.value === 'scanning') {
      return
    }
    if (!navigator.mediaDevices || !videoElement.value) {
      cameraState.value = 'unavailable'
      return
    }
    lastCode.value = null
    cameraState.value = 'starting'
    startGeneration += 1
    const currentGeneration = startGeneration
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ])
      const decodeHints = new Map([
        [DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]],
      ])
      const reader = new BrowserMultiFormatReader(decodeHints)
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoElement.value,
        (decodedResult, _decodingFailure, scannerControls) => {
          if (!decodedResult || currentGeneration !== startGeneration) {
            return
          }
          lastCode.value = decodedResult.getText()
          navigator.vibrate?.(vibrationMilliseconds)
          scannerControls.stop()
          stop()
        },
      )
      if (currentGeneration !== startGeneration) {
        controls.stop()
        stopVideoTracks(videoElement.value)
        return
      }
      activeControls = controls
      cameraState.value = 'scanning'
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }
    catch (failure) {
      if (currentGeneration !== startGeneration) {
        return
      }
      stopVideoTracks(videoElement.value)
      const failureName = (failure as { name?: string }).name ?? ''
      cameraState.value = deniedErrorNames.includes(failureName) ? 'denied' : 'unavailable'
    }
  }

  onBeforeUnmount(stop)

  return { videoElement, start, stop, lastCode, cameraState }
}
