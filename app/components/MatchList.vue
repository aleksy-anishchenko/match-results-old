<script setup lang="ts">
import type { Match } from '~/types'

defineProps<{
  matches: Record<string, Match[]>
  showDate?: boolean
  /** Приписка к заголовку дня по дате (YYYY-MM-DD): «Воскресенье, 20 сентября · 5 тур» */
  dayNotes?: Record<string, string>
}>()
</script>

<template>
  <div class="days">
    <section
      v-for="(dayMatches, date) in matches"
      :key="date"
      class="day"
    >
      <h2
        v-if="showDate"
        class="day__title"
      >
        {{ formatReadableDate(String(date)) }}<template v-if="dayNotes?.[date]">
          · {{ dayNotes[date] }}
        </template>
      </h2>
      <ul class="day__card">
        <li
          v-for="match in dayMatches"
          :key="match.idEvent"
          class="day__row"
        >
          <MatchItem :match="match" />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped lang="scss">
.days {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.day {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.day__title {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: $color-text-2;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.day__card {
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card;
  overflow: hidden;
}

.day__row + .day__row {
  border-top: 1px solid $color-border-soft;
}

@media (min-width: $breakpoint-desktop) {
  .days {
    gap: 24px;
  }

  .day__title {
    margin-top: 8px;
    font-size: 13px;
  }
}
</style>
