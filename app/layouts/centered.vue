<template>
  <v-main>
    <v-container>
      <div class="kairos-auth">
        <div class="kairos-auth__brand">
          <KairosLogo class="centered-layout__logo" />
          <p class="kairos-auth__brand-name">
            Kairos
          </p>
        </div>
        <slot />
      </div>
    </v-container>
  </v-main>
</template>

<style scoped>
.centered-layout__logo.kairos-logo {
  width: 44px;
  height: 44px;
}
</style>
