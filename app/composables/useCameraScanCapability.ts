export const useCameraScanCapability = () => {
  const isCameraScanAvailable = ref(false)

  onMounted(() => {
    const phoneQuery = window.matchMedia('(pointer: coarse), (max-width: 959px)')
    const evaluateCapability = () => {
      isCameraScanAvailable.value = canUseCameraScan({
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        viewportWidth: window.innerWidth,
      })
    }
    evaluateCapability()
    phoneQuery.addEventListener('change', evaluateCapability)
    onBeforeUnmount(() => phoneQuery.removeEventListener('change', evaluateCapability))
  })

  return { isCameraScanAvailable }
}
