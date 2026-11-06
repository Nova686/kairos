import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { brandColorStylesheet, brandColorVariables } from '../../../shared/theme/brand-color-stylesheet.ts'
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
} from '../../../shared/theme/brand-colors.ts'

const coffreStylesheet = readFileSync(new URL('../../../app/assets/styles/coffre.css', import.meta.url), 'utf8')

describe('brandColorVariables', () => {
  it('names every brand colour as its Coffre CSS variable', () => {
    expect(brandColorVariables).toEqual({
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
    })
  })
})

describe('brandColorStylesheet', () => {
  it('declares every brand colour variable on the root element', () => {
    expect(brandColorStylesheet.startsWith(':root{')).toBe(true)
    expect(brandColorStylesheet.endsWith('}')).toBe(true)
    for (const [variableName, colour] of Object.entries(brandColorVariables)) {
      expect(brandColorStylesheet).toContain(`${variableName}:${colour};`)
    }
  })

  it('writes no brand colour as a literal in the Coffre stylesheet, so gradients follow the variables', () => {
    for (const colour of Object.values(brandColorVariables)) {
      expect(coffreStylesheet.toLowerCase(), colour).not.toContain(colour.toLowerCase())
    }
  })

  it('leaves the brand colour variables to the generated stylesheet only', () => {
    for (const variableName of Object.keys(brandColorVariables)) {
      expect(coffreStylesheet, variableName).not.toMatch(new RegExp(`${variableName}\\s*:`))
    }
  })
})
