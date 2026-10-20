<script setup lang="ts">
// Лига и разделы «Матчи / Таблица» — на самих страницах (CompetitionBar), в шапке только логотип и «О проекте»
const route = useRoute()
const isAbout = computed(() => route.path.startsWith('/about'))
</script>

<template>
  <header class="header">
    <div class="header__inner container">
      <NuxtLink
        to="/"
        class="logo"
        aria-label="MatchResults — на главную"
      >
        <img
          src="/logo.svg"
          class="logo__mark"
          width="30"
          height="30"
          alt=""
        >
        <span class="logo__text">MatchResults</span>
      </NuxtLink>

      <nav aria-label="Основная навигация">
        <NuxtLink
          to="/about"
          class="nav__link"
          :class="{ 'nav__link--active': isAbout }"
          :aria-current="isAbout ? 'page' : undefined"
        >
          О проекте
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header {
  background: $color-surface;
  border-bottom: 1px solid $color-border;
}

.header__inner {
  height: $header-height-mobile;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    height: $header-height;
    gap: 32px;
  }
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;

  @media (min-width: $breakpoint-desktop) {
    gap: 10px;
  }
}

// Зелёный круг уже нарисован в самом logo.svg, фон и скругление не нужны
.logo__mark {
  width: 26px;
  height: 26px;
  flex-shrink: 0;

  @media (min-width: $breakpoint-desktop) {
    width: 30px;
    height: 30px;
  }
}

.logo__text {
  font-family: $font-display;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.02em;
  white-space: nowrap;

  @media (min-width: $breakpoint-desktop) {
    font-size: 17px;
  }
}

.nav__link {
  display: flex;
  align-items: center;
  height: $header-height-mobile;
  padding: 0 2px;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-3;
  white-space: nowrap;
  transition: color 0.15s;

  &:hover {
    color: $color-text;
  }

  &--active {
    color: $color-text;
  }

  @media (min-width: $breakpoint-desktop) {
    height: $header-height;
    font-size: 15px;
  }
}
</style>
