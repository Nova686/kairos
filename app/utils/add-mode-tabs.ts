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

export const resolveDisplayedAddTab = (requestedTab: AddProductTab, availableTabs: AddProductTab[]): AddProductTab =>
  availableTabs.includes(requestedTab) ? requestedTab : 'texte'
