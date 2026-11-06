import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['probe-reports/**', '.superpowers/**'],
})
