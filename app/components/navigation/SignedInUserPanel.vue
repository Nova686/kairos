<template>
  <div
    v-if="user"
    class="signed-in-user-panel"
  >
    <div class="signed-in-user-panel__identity">
      <span
        class="signed-in-user-panel__avatar"
        aria-hidden="true"
      >{{ userInitials }}</span>
      <div class="signed-in-user-panel__names">
        <span class="signed-in-user-panel__display-name">{{ user.displayName }}</span>
        <span class="signed-in-user-panel__email">{{ user.email }}</span>
      </div>
    </div>
    <button
      type="button"
      class="signed-in-user-panel__sign-out"
      @click="signOut"
    >
      <v-icon
        icon="mdi-logout"
        size="20"
      />
      Se déconnecter
    </button>
  </div>
</template>

<script setup lang="ts">
const { user } = useUserSession()
const { signOut } = useSignOut()
const userInitials = computed(() => describeUserInitials(user.value?.displayName ?? ''))
</script>

<style scoped>
.signed-in-user-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--kairos-border);
}

.signed-in-user-panel__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  min-width: 0;
}

.signed-in-user-panel__avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--kairos-surface-variant);
  border: 1px solid var(--kairos-border);
  color: var(--kairos-accent);
  font: 600 13px var(--kairos-display-font);
}

.signed-in-user-panel__names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.signed-in-user-panel__display-name {
  overflow: hidden;
  color: var(--kairos-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signed-in-user-panel__email {
  overflow: hidden;
  color: var(--kairos-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signed-in-user-panel__sign-out {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--kairos-text-secondary);
  font: inherit;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.signed-in-user-panel__sign-out:hover {
  background: var(--kairos-surface);
  color: var(--kairos-text);
}

.signed-in-user-panel__sign-out:focus-visible {
  outline: 2px solid var(--kairos-primary);
}
</style>
