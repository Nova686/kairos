<template>
  <nav
    class="main-navigation d-none d-md-flex"
    aria-label="Navigation Kairos"
  >
    <div class="main-navigation__brand">
      <KairosLogo />
      <span>Kairos</span>
    </div>
    <template
      v-for="navigationEntry in mainNavigationEntries"
      :key="navigationEntry.path"
    >
      <div
        v-if="navigationEntry.path === separatorBeforePath"
        class="main-navigation__separator"
      />
      <NuxtLink
        :to="navigationEntry.path"
        class="main-navigation__item"
        :class="{ 'main-navigation__item--active': isEntryActive(navigationEntry) }"
        :aria-current="isEntryActive(navigationEntry) ? 'page' : undefined"
      >
        <v-icon
          :icon="navigationEntry.icon"
          size="22"
        />
        {{ navigationEntry.label }}
      </NuxtLink>
    </template>
  </nav>
</template>

<script setup lang="ts">
const { mainNavigationEntries, isEntryActive } = useMainNavigation()
const separatorBeforePath = '/lieux'
</script>

<style scoped>
.main-navigation {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 1004;
  width: var(--kairos-sidebar-width);
  flex-direction: column;
  gap: 4px;
  padding: 18px 12px;
  overflow-y: auto;
  background: #0e131a;
  border-right: 1px solid var(--kairos-border);
  scrollbar-width: none;
}

.main-navigation::-webkit-scrollbar {
  display: none;
}

.main-navigation__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 18px;
  font: 700 18px var(--kairos-display-font);
  letter-spacing: -0.01em;
}

.main-navigation__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  color: var(--kairos-text-secondary);
  font-weight: 500;
  text-decoration: none;
}

.main-navigation__item:hover {
  color: var(--kairos-text);
}

.main-navigation__item:focus-visible {
  outline: 2px solid var(--kairos-primary);
  outline-offset: -2px;
}

.main-navigation__item--active {
  color: var(--kairos-text);
  background: var(--kairos-surface-variant);
}

.main-navigation__item--active .v-icon {
  color: var(--kairos-primary);
}

.main-navigation__separator {
  height: 1px;
  margin: 10px 8px;
  background: var(--kairos-border);
}
</style>
