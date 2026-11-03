import { startEndToEndServer, $fetch } from '../support/end-to-end-server.ts'

describe('application shell', async () => {
  await startEndToEndServer()

  it('sends an anonymous visitor to the sign-in page titled Kairos', async () => {
    const homePageHtml = await $fetch<string>('/')

    expect(homePageHtml).toContain('Kairos')
    expect(homePageHtml).toContain('Se connecter')
  })
})
