<script setup lang="ts">
import type { CompetitionWithBadge } from '~/types'

const { selectedId } = useCompetition()
const route = useRoute()

// Страница матча относится к разделу «Результаты», поэтому проверяем по префиксу
const navItems = [
  { to: '/', label: 'Результаты', isActive: (path: string) => path === '/' || path.startsWith('/match/') },
  { to: '/standings', label: 'Таблица', isActive: (path: string) => path.startsWith('/standings') },
  { to: '/about', label: 'О проекте', isActive: (path: string) => path.startsWith('/about') },
]

const { data: competitionsData } = await useFetch<{ competitions: CompetitionWithBadge[] }>('/api/competitions')

const badgeById = computed(() => {
  const map: Record<string, string> = {}
  for (const competition of competitionsData.value?.competitions ?? []) {
    if (competition.badge) map[competition.id] = competition.badge
  }
  return map
})

const competitionGroups = COMPETITION_CATEGORIES.map(category => ({
  label: category,
  items: COMPETITIONS.filter(competition => competition.category === category),
}))

function competitionName(id: string): string {
  return getCompetition(id)?.name ?? ''
}

function isWhiteBadge(id: string): boolean {
  return getCompetition(id)?.whiteBadge ?? false
}

function badgeUrl(id: string): string {
  const badge = badgeById.value[id]
  return badge ? getBadgeUrl(badge) : ''
}
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

      <nav
        class="nav"
        aria-label="Основная навигация"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav__link"
          :class="{ 'nav__link--active': item.isActive(route.path) }"
          :aria-current="item.isActive(route.path) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <Select
        v-model="selectedId"
        :options="competitionGroups"
        option-label="name"
        option-value="id"
        option-group-label="label"
        option-group-children="items"
        aria-label="Выбор турнира"
        class="comp-select"
      >
        <template #value="slotProps">
          <div
            v-if="slotProps.value"
            class="comp-value"
          >
            <img
              v-if="badgeUrl(slotProps.value)"
              :src="badgeUrl(slotProps.value)"
              :class="['comp-ico', { 'comp-ico--bg': isWhiteBadge(slotProps.value) }]"
              alt=""
            >
            <span class="comp-name">{{ competitionName(slotProps.value) }}</span>
          </div>
          <span v-else>{{ slotProps.placeholder }}</span>
        </template>
        <template #option="slotProps">
          <div class="comp-value">
            <img
              v-if="badgeUrl(slotProps.option.id)"
              :src="badgeUrl(slotProps.option.id)"
              :class="['comp-ico', { 'comp-ico--bg': isWhiteBadge(slotProps.option.id) }]"
              alt=""
            >
            <span class="comp-name">{{ slotProps.option.name }}</span>
            <span class="comp-country">{{ slotProps.option.country }}</span>
          </div>
        </template>
      </Select>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header {
  background: $color-surface;
  border-bottom: 1px solid $color-border;
}

// До 640px: логотип и селектор в одной строке, навигация строкой ниже.
// От 640px: всё в одной строке высотой 64px. Селектор занимает остаток ширины
// и умеет сжиматься (minmax(0, 1fr)), название турнира обрезается многоточием.
.header__inner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'logo select'
    'nav nav';
  column-gap: 12px;
  align-items: center;

  @media (min-width: $breakpoint-desktop) {
    grid-template-columns: auto auto minmax(0, 1fr);
    grid-template-areas: 'logo nav select';
    column-gap: 20px;
    height: $header-height;
  }

  // Полная ширина контента: отступы как в макете
  @media (min-width: $content-width) {
    column-gap: 32px;
  }
}

.logo {
  grid-area: logo;
  display: flex;
  align-items: center;
  gap: 8px;
  height: $header-height-mobile;

  @media (min-width: $breakpoint-desktop) {
    gap: 10px;
    height: auto;
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

.nav {
  grid-area: nav;
  display: flex;
  // Выходим за поля контейнера, чтобы разделитель шёл от края до края экрана
  margin: 0 (-$container-padding);
  border-top: 1px solid $color-border-soft;

  @media (min-width: $breakpoint-desktop) {
    margin: 0;
    border-top: none;
    gap: 20px;
  }

  @media (min-width: $content-width) {
    gap: 24px;
  }
}

.nav__link {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: $mobile-nav-height;
  font-size: 14px;
  font-weight: 500;
  color: $color-text-3;
  white-space: nowrap;
  transition: color 0.15s;

  &:hover {
    color: $color-text;
  }

  &--active {
    font-weight: 600;
    color: $color-text;
    box-shadow: inset 0 -2px 0 $color-accent;
  }

  @media (min-width: $breakpoint-desktop) {
    flex: none;
    height: $header-height;
    font-size: 15px;
  }
}

// Селектор турнира в виде «пилюли». Класс попадает на корневой элемент PrimeVue Select,
// внутренние части (label, стрелка) достаём через :deep.
.comp-select {
  grid-area: select;
  justify-self: end;
  width: auto;
  max-width: 100%;
  min-width: 0;
  height: 40px;
  align-items: center;
  border-radius: $radius-pill;
  border-color: $color-border-strong;
  background: $color-surface;
  box-shadow: none;

  :deep(.p-select-label) {
    padding: 0 2px 0 14px;
    font-size: 14px;
    font-weight: 500;
    color: $color-text;
  }

  :deep(.p-select-dropdown) {
    width: 32px;
    color: $color-text;
  }
}

.comp-value {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.comp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comp-country {
  flex-shrink: 0;
  color: $color-text-muted;
  font-size: 12px;
}

.comp-ico {
  width: 18px;
  height: 18px;
  object-fit: contain;
  flex-shrink: 0;
}

// Белые логотипы (ЛЧ, ЛЕ) на белом не видны, подкладываем самый тёмный цвет палитры
.comp-ico--bg {
  background: $color-text;
  padding: 2px;
  border-radius: 4px;
}
</style>
