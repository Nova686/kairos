const longestSideInPixels = 1024
const jpegQuality = 0.85

export const computeTargetDimensions = (
  width: number,
  height: number,
  longestSide: number = longestSideInPixels,
): { width: number, height: number } => {
  const scale = Math.min(1, longestSide / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const decodeImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file)
    const decodedImage = new Image()
    decodedImage.onload = () => {
      URL.revokeObjectURL(sourceUrl)
      resolve(decodedImage)
    }
    decodedImage.onerror = () => {
      URL.revokeObjectURL(sourceUrl)
      reject(new Error('Cette image ne peut pas être lue.'))
    }
    decodedImage.src = sourceUrl
  })

export const resizePhoto = async (file: File): Promise<Blob> => {
  const decodedImage = await decodeImage(file)
  const { width, height } = computeTargetDimensions(decodedImage.naturalWidth, decodedImage.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const drawingContext = canvas.getContext('2d')
  if (drawingContext === null) {
    throw new Error('Cette image ne peut pas être traitée.')
  }
  drawingContext.drawImage(decodedImage, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      jpegBlob => (jpegBlob ? resolve(jpegBlob) : reject(new Error('Cette image ne peut pas être convertie.'))),
      'image/jpeg',
      jpegQuality,
    )
  })
}
