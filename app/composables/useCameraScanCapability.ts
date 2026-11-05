export const useCameraScanCapability = () => {
  const isCameraScanAvailable = ref(false)

  onMounted(() => {
    isCameraScanAvailable.value = canUseCameraScan({
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      viewportWidth: window.innerWidth,
      hasMediaDevices: navigator.mediaDevices !== undefined,
    })
  })

  return { isCameraScanAvailable }
}
