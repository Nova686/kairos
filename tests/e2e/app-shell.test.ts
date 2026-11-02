import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

describe('application shell', async () => {
  await setup({ rootDir: fileURLToPath(new URL('../..', import.meta.url)), server: true })

  it('serves the home page with the app title and the stock entry', async () => {
    const homePageHtml = await $fetch<string>('/')

    expect(homePageHtml).toContain('Kairos')
    expect(homePageHtml).toContain('Stock')
  })
})
