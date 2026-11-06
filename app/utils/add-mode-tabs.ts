export const addProductTabs = ['code-barres', 'photo', 'texte'] as const

export type AddProductTab = typeof addProductTabs[number]

export interface AddModeAvailability {
  cameraScanAvailable: boolean
  photoRecognitionAvailable: boolean
}

export const buildAddModeTabs = (availability: AddModeAvailability): AddProductTab[] => {
  if (!availability.cameraScanAvailable) {
    return ['texte']
  }
  return availability.photoRecognitionAvailable ? ['code-barres', 'photo', 'texte'] : ['code-barres', 'texte']
}

export const resolveDisplayedAddTab = (requestedTab: AddProductTab | null, availableTabs: AddProductTab[]): AddProductTab => {
  if (requestedTab === null) {
    return availableTabs[0] ?? 'texte'
  }
  return availableTabs.includes(requestedTab) ? requestedTab : 'texte'
}

type CameraFallbackTab = Exclude<AddProductTab, 'code-barres'>

export interface CameraFallback {
  tab: CameraFallbackTab
  linkLabel: string
}

const cameraFallbackLinkLabels: Record<CameraFallbackTab, string> = {
  photo: 'ou prenez une photo',
  texte: 'ou cherchez le produit par son nom',
}

const isCameraFallbackTab = (tab: AddProductTab): tab is CameraFallbackTab => tab !== 'code-barres'

export const describeCameraFallback = (photoRecognitionAvailable: boolean): CameraFallback => {
  const fallbackTab = buildAddModeTabs({ cameraScanAvailable: true, photoRecognitionAvailable }).find(isCameraFallbackTab) ?? 'texte'
  return { tab: fallbackTab, linkLabel: cameraFallbackLinkLabels[fallbackTab] }
}
