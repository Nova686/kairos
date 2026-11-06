<template>
  <nav
    class="mobile-navigation kairos-phone-only"
    aria-label="Navigation mobile"
  >
    <NuxtLink
      v-for="navigationEntry in bottomBarEntries"
      :key="navigationEntry.path"
      :to="navigationEntry.path"
      class="mobile-navigation__item"
      :class="{ 'mobile-navigation__item--active': isEntryActive(navigationEntry) }"
      :aria-current="isEntryActive(navigationEntry) ? 'page' : undefined"
    >
      <span
        v-if="navigationEntry.isPrimaryAction"
        class="mobile-navigation__add"
      >
        <v-icon
          icon="mdi-plus"
          size="22"
        />
      </span>
      <v-icon
        v-else
        :icon="navigationEntry.icon"
        size="22"
      />
      {{ navigationEntry.shortLabel }}
    </NuxtLink>
    <button
      type="button"
      class="mobile-navigation__item"
      :class="{ 'mobile-navigation__item--active': isMoreMenuActive || isMoreMenuOpen }"
      aria-haspopup="dialog"
      :aria-label="moreMenuButtonLabel"
      :aria-expanded="isMoreMenuOpen"
      @click="isMoreMenuOpen = true"
    >
      <v-icon
        icon="mdi-dots-horizontal"
        size="22"
      />
      Plus
    </button>
    <v-bottom-sheet
      v-model="isMoreMenuOpen"
      aria-label="Plus"
    >
      <v-card class="mobile-navigation__sheet">
        <div
          v-if="user"
          class="mobile-navigation__identity"
        >
          <span
            class="mobile-navigation__avatar"
            aria-hidden="true"
          >{{ userInitials }}</span>
          <div class="mobile-navigation__names">
            <span class="mobile-navigation__display-name">{{ user.displayName }}</span>
            <span class="mobile-navigation__email">{{ user.email }}</span>
          </div>
        </div>
        <v-list
          bg-color="transparent"
          nav
        >
          <v-list-item
            v-for="navigationEntry in moreMenuEntries"
            :key="navigationEntry.path"
            :to="navigationEntry.path"
            :prepend-icon="navigationEntry.icon"
            :title="navigationEntry.label"
            :active="isEntryActive(navigationEntry)"
            @click="isMoreMenuOpen = false"
          />
          <v-divider class="my-2" />
          <v-list-item
            prepend-icon="mdi-logout"
            title="Se déconnecter"
            @click="signOutFromMoreMenu"
          />
        </v-list>
      </v-card>
    </v-bottom-sheet>
  </nav>
</template>

<script setup lang="ts">
const { bottomBarEntries, moreMenuEntries, isEntryActive, isMoreMenuActive } = useMainNavigation()
const { signOut } = useSignOut()
const { user } = useUserSession()
const userInitials = computed(() => describeUserInitials(user.value?.displayName ?? ''))
const isMoreMenuOpen = ref(false)

const activeMoreEntry = computed(() => moreMenuEntries.find(isEntryActive))
const moreMenuButtonLabel = computed(() =>
  activeMoreEntry.value ? `Plus, page active : ${activeMoreEntry.value.label}` : 'Plus',
)

onMounted(() => {
  const desktopViewport = window.matchMedia('(min-width: 960px)')
  const closeMoreMenuOnDesktop = (event: MediaQueryListEvent) => {
    if (event.matches) {
      isMoreMenuOpen.value = false
    }
  }
  desktopViewport.addEventListener('change', closeMoreMenuOnDesktop)
  onBeforeUnmount(() => desktopViewport.removeEventListener('change', closeMoreMenuOnDesktop))
})

const signOutFromMoreMenu = async () => {
  isMoreMenuOpen.value = false
  await signOut()
}
</script>

<style scoped>
.mobile-navigation {
  position: fixed;
  inset: auto 0 0;
  z-index: 1004;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  box-sizing: border-box;
  height: var(--kairos-bottom-bar-clearance);
  padding: 8px calc(6px + env(safe-area-inset-right, 0px)) env(safe-area-inset-bottom, 0px) calc(6px + env(safe-area-inset-left, 0px));
  background: var(--kairos-surface);
  border-top: 1px solid var(--kairos-border);
}

.mobile-navigation__item {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 0;
  border: 0;
  background: none;
  font: 500 10.5px var(--kairos-body-font);
  color: var(--kairos-text-secondary);
  text-decoration: none;
  cursor: pointer;
}

.mobile-navigation__item:focus-visible {
  outline: 2px solid var(--kairos-primary);
  border-radius: 8px;
}

.mobile-navigation__item--active {
  color: var(--kairos-primary);
}

.mobile-navigation__add {
  display: grid;
  place-items: center;
  width: 44px;
  height: 30px;
  border-radius: 999px;
  background: var(--kairos-primary);
  color: var(--kairos-background);
}

.mobile-navigation__sheet {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-navigation__identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--kairos-border);
}

.mobile-navigation__avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--kairos-surface-variant);
  border: 1px solid var(--kairos-border);
  color: var(--kairos-accent);
  font: 600 14px var(--kairos-display-font);
}

.mobile-navigation__names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mobile-navigation__display-name {
  overflow: hidden;
  color: var(--kairos-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-navigation__email {
  overflow: hidden;
  color: var(--kairos-text-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
