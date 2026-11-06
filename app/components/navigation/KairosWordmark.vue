<template>
  <span
    class="kairos-wordmark"
    role="img"
    aria-label="Kairos"
  >
    <span aria-hidden="true">ka</span><span
      class="kairos-wordmark__dotless-i"
      aria-hidden="true"
    >ı<span class="kairos-wordmark__diamond" /></span><span aria-hidden="true">ros</span>
  </span>
</template>

<style scoped>
.kairos-wordmark {
  display: inline-block;
  font-family: var(--kairos-display-font);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--kairos-text);
  white-space: nowrap;
}

.kairos-wordmark__dotless-i {
  position: relative;
  display: inline-block;
}

.kairos-wordmark__diamond {
  position: absolute;
  top: 0.05em;
  left: 50%;
  width: 0.19em;
  height: 0.19em;
  background: var(--kairos-accent);
  transform: translateX(-50%) rotate(45deg);
}
</style>
