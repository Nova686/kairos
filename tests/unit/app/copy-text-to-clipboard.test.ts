import { describe, expect, it } from 'vitest'
import { copyTextToClipboard } from '../../../app/utils/copy-text-to-clipboard.ts'

describe('copyTextToClipboard', () => {
  it('writes the text and reports success', async () => {
    const writtenTexts: string[] = []

    const hasCopied = await copyTextToClipboard({ writeText: async (text) => { writtenTexts.push(text) } }, 'LP123FR')

    expect(hasCopied).toBe(true)
    expect(writtenTexts).toEqual(['LP123FR'])
  })

  it('reports a failure when the clipboard is missing or refuses the write', async () => {
    expect(await copyTextToClipboard(undefined, 'LP123FR')).toBe(false)
    expect(await copyTextToClipboard({ writeText: () => Promise.reject(new Error('NotAllowedError')) }, 'LP123FR')).toBe(false)
  })
})
