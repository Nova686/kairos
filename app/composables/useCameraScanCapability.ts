const phoneMediaQuery = '(pointer: coarse), (max-width: 959px)'

const readBrowserCameraScanCapability = (): boolean =>
  canUseCameraScan({
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    viewportWidth: window.innerWidth,
  })

export const useCameraScanCapability = () => {
  const requestHeaders = useRequestHeaders(['sec-ch-ua-mobile', 'user-agent'])
  const isCameraScanAvailable = useState('camera-scan-available', () =>
    import.meta.server
      ? guessCameraScanFromRequest({ mobileClientHint: requestHeaders['sec-ch-ua-mobile'], userAgent: requestHeaders['user-agent'] })
      : readBrowserCameraScanCapability())

  onMounted(() => {
    const phoneQuery = window.matchMedia(phoneMediaQuery)
    const evaluateCapability = () => {
      isCameraScanAvailable.value = readBrowserCameraScanCapability()
    }
    evaluateCapability()
    phoneQuery.addEventListener('change', evaluateCapability)
    onBeforeUnmount(() => phoneQuery.removeEventListener('change', evaluateCapability))
  })

  return { isCameraScanAvailable }
}
