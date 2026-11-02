import { fileURLToPath } from 'node:url'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

describe('application shell', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    server: true,
    nuxtConfig: { runtimeConfig: { appSecret: 'kairos-end-to-end-app-secret-1234567890' } },
  })

  it('sends an anonymous visitor to the sign-in page titled Kairos', async () => {
    const homePageHtml = await $fetch<string>('/')

    expect(homePageHtml).toContain('Kairos')
    expect(homePageHtml).toContain('Se connecter')
  })
})
