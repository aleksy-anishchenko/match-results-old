<script setup lang="ts">
import type { MatchStat } from '~/types'

defineProps<{ stats: MatchStat[] }>()

function formatValue(value: number, format: MatchStat['format']): string {
  if (format === 'percent') return `${value}%`
  if (format === 'decimal') return value.toFixed(2)
  return String(value)
}

// Кто впереди по показателю: его число и полоска выделены. Поровну — никто
function leader(stat: MatchStat): 'home' | 'away' | null {
  if (stat.home === stat.away) return null
  return stat.home > stat.away ? 'home' : 'away'
}

// Доли полоски хозяев и гостей; у обоих нулей — пополам
function barParts(stat: MatchStat): [number, number] {
  return stat.home || stat.away ? [stat.home, stat.away] : [1, 1]
}
</script>

<template>
  <section
    class="stats"
    aria-labelledby="stats-title"
  >
    <h2
      id="stats-title"
      class="stats__title"
    >
      Статистика
    </h2>
    <ul class="stats__list">
      <li
        v-for="stat in stats"
        :key="stat.label"
        class="stat"
      >
        <span
          class="stat__value stat__value--home num"
          :class="{ 'stat__value--lead': leader(stat) === 'home' }"
        >{{ formatValue(stat.home, stat.format) }}</span>
        <span class="stat__label">{{ stat.label }}</span>
        <span
          class="stat__value stat__value--away num"
          :class="{ 'stat__value--lead': leader(stat) === 'away' }"
        >{{ formatValue(stat.away, stat.format) }}</span>
        <span
          class="stat__bar"
          :class="{ 'stat__bar--split': barParts(stat).every(part => part > 0) }"
          aria-hidden="true"
        >
          <span
            class="stat__part"
            :class="{ 'stat__part--lead': leader(stat) === 'home' }"
            :style="{ flexGrow: barParts(stat)[0] }"
          />
          <span
            class="stat__part"
            :class="{ 'stat__part--lead': leader(stat) === 'away' }"
            :style="{ flexGrow: barParts(stat)[1] }"
          />
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 12px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card-lg;

  @media (min-width: $breakpoint-desktop) {
    padding: 20px 24px;
  }
}

.stats__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: $color-text-2;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stats__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stat {
  display: grid;
  grid-template-columns: 52px 1fr 52px;
  align-items: baseline;
  row-gap: 6px;
  font-size: 14px;
}

.stat__label {
  color: $color-text-2;
  text-align: center;
}

.stat__value {
  font-weight: 600;
  color: $color-text-3;
  font-variant-numeric: tabular-nums;

  &--home {
    text-align: left;
  }

  &--away {
    text-align: right;
  }

  &--lead {
    font-weight: 700;
    color: $color-accent-dark;
  }
}

// Просвет между частями, только когда видны обе: у 0:3 полоска целиком у гостей
.stat__bar {
  display: flex;
  grid-column: 1 / -1;
  height: 6px;

  &--split {
    gap: 4px;
  }
}

.stat__part {
  flex-basis: 0;
  min-width: 0;
  border-radius: $radius-pill;
  background: $color-border;

  &--lead {
    background: $color-accent;
  }
}
</style>
