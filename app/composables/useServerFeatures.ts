interface ServerFeaturesResponse {
  photoRecognition: boolean
}

export const useServerFeatures = async () => {
  const { data: fetchedFeatures } = await useFetch<ServerFeaturesResponse>('/api/settings/features', {
    key: 'server-features',
    default: () => ({ photoRecognition: true }),
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })

  const isPhotoRecognitionAvailable = computed(() => fetchedFeatures.value?.photoRecognition !== false)

  return { isPhotoRecognitionAvailable }
}
