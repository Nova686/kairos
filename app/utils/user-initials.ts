export const describeUserInitials = (displayName: string): string => {
  const nameWords = displayName.trim().split(/\s+/).filter(nameWord => nameWord.length > 0)
  if (nameWords.length === 0) {
    return '?'
  }
  return nameWords
    .slice(0, 2)
    .map(nameWord => nameWord.charAt(0).toLocaleUpperCase('fr-FR'))
    .join('')
}
