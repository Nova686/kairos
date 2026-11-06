import {
  brandAccentColor,
  brandBackgroundColor,
  brandBorderColor,
  brandErrorColor,
  brandPrimaryColor,
  brandSecondaryTextColor,
  brandSuccessColor,
  brandSurfaceColor,
  brandSurfaceVariantColor,
  brandTextColor,
} from './brand-colors.ts'

export const brandColorVariables: Record<string, string> = {
  '--kairos-background': brandBackgroundColor,
  '--kairos-surface': brandSurfaceColor,
  '--kairos-surface-variant': brandSurfaceVariantColor,
  '--kairos-border': brandBorderColor,
  '--kairos-text': brandTextColor,
  '--kairos-text-secondary': brandSecondaryTextColor,
  '--kairos-primary': brandPrimaryColor,
  '--kairos-accent': brandAccentColor,
  '--kairos-success': brandSuccessColor,
  '--kairos-error': brandErrorColor,
}

const declareVariables = (variables: Record<string, string>): string =>
  Object.entries(variables).map(([variableName, colour]) => `${variableName}:${colour};`).join('')

export const brandColorStylesheet = `:root{${declareVariables(brandColorVariables)}}`
