<template>
  <div>
    <MainNavigation />
    <v-main class="kairos-shell__main">
      <v-container>
        <slot />
      </v-container>
    </v-main>
    <MobileNavigation />
  </div>
</template>
