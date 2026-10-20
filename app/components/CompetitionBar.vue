<script setup lang="ts">
const route = useRoute()

// Это переход между страницами, а не вкладки на одной странице: обычные ссылки, выбранная — aria-current
const sections = [
  { to: '/', label: 'Матчи' },
  { to: '/standings', label: 'Таблица' },
]
</script>

<template>
  <div class="bar">
    <LeagueSelect />
    <nav
      class="sections"
      aria-label="Раздел"
    >
      <NuxtLink
        v-for="section in sections"
        :key="section.to"
        :to="section.to"
        class="sections__link"
        :class="{ 'sections__link--active': route.path === section.to }"
        :aria-current="route.path === section.to ? 'page' : undefined"
      >
        {{ section.label }}
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped lang="scss">
// Лига слева, разделы справа, под ними общая линия. Поле лиги сжимается, разделы — нет
.bar {
  min-height: 56px;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid $color-border;

  > :first-child {
    align-self: center;
  }
}

.sections {
  display: flex;
  flex-shrink: 0;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.sections__link {
  display: flex;
  align-items: center;
  padding: 0 2px;
  font-size: 15px;
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
}
</style>
