<script setup lang="ts">
import type { MatchEvent } from '~/types'

defineProps<{ events: MatchEvent[] }>()

const NOTES: Partial<Record<MatchEvent['kind'], string>> = {
  'penalty': 'пен.',
  'own-goal': 'авт.',
}

// Подпись значка для экранного диктора
const KIND_NAMES: Record<MatchEvent['kind'], string> = {
  'goal': 'Гол',
  'penalty': 'Гол',
  'own-goal': 'Гол',
  'yellow-card': 'Жёлтая карточка',
  'red-card': 'Красная карточка',
  'substitution': 'Замена',
}

const isGoal = (event: MatchEvent) => event.kind === 'goal' || event.kind === 'penalty' || event.kind === 'own-goal'
</script>

<template>
  <section
    class="timeline"
    aria-labelledby="timeline-title"
  >
    <h2
      id="timeline-title"
      class="timeline__title"
    >
      Хроника матча
    </h2>
    <!-- Как в шапке: события хозяев слева, гостей справа, минута посередине. Значок — ближе к минуте -->
    <ul class="timeline__list">
      <li
        v-for="(event, index) in events"
        :key="index"
        class="event"
        :class="[`event--${event.side}`, { 'event--goal': isGoal(event) }]"
      >
        <span class="event__body">
          <svg
            v-if="isGoal(event)"
            class="event__icon event__icon--goal"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            role="img"
            :aria-label="KIND_NAMES[event.kind]"
          >
            <circle
              cx="8"
              cy="8"
              r="6.75"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M8 4.6l3.1 2.25-1.2 3.65H6.1L4.9 6.85z"
              fill="currentColor"
            />
          </svg>
          <svg
            v-else-if="event.kind === 'substitution'"
            class="event__icon event__icon--substitution"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            role="img"
            :aria-label="KIND_NAMES[event.kind]"
          >
            <path
              class="event__arrow-in"
              d="M5 13.5V3M2 6l3-3 3 3"
              fill="none"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              class="event__arrow-out"
              d="M11 2.5V13M8 10l3 3 3-3"
              fill="none"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else
            class="event__icon"
            :class="`event__icon--${event.kind}`"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            role="img"
            :aria-label="KIND_NAMES[event.kind]"
          >
            <rect
              x="3.5"
              y="1.5"
              width="9"
              height="13"
              rx="1.5"
              fill="currentColor"
            />
          </svg>
          <span class="event__text">
            <span class="event__player">
              {{ event.player }}<span
                v-if="NOTES[event.kind]"
                class="event__note"
              > ({{ NOTES[event.kind] }})</span>
            </span>
            <span
              v-if="event.assist"
              class="event__extra"
            >пас: {{ event.assist }}</span>
            <span
              v-if="event.playerOut"
              class="event__extra"
            >вместо {{ event.playerOut }}</span>
          </span>
        </span>
        <span class="event__minute">{{ event.minute }}′</span>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.timeline {
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

.timeline__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: $color-text-2;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.timeline__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

// Строки одной высоты: минута и значок стоят вровень с первой строкой имени, даже если под ним пас или замена
.event {
  display: grid;
  grid-template-columns: 1fr 44px 1fr;
  align-items: start;
  font-size: 14px;
  line-height: 21px;
  color: $color-text-2;
}

.event__minute {
  grid-column: 2;
  grid-row: 1;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 700;
  color: $color-text-3;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.event__body {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  grid-row: 1;
  min-width: 0;
}

// Хозяева: значок справа, у минуты, текст прижат к нему
.event--home .event__body {
  grid-column: 1;
  flex-direction: row-reverse;
  text-align: right;
}

.event--away .event__body {
  grid-column: 3;
}

.event__icon {
  flex-shrink: 0;
  // По центру первой строки текста
  margin-top: 2.5px;

  &--goal {
    color: $color-accent-dark;
  }

  &--yellow-card {
    color: $color-card-yellow;
  }

  &--red-card {
    color: $color-card-red;
  }
}

.event__arrow-in {
  stroke: $color-accent;
}

.event__arrow-out {
  stroke: $color-live;
}

.event__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
}

.event__extra {
  font-size: 12px;
  line-height: 16px;
  color: $color-text-3;
}

.event__note {
  color: $color-text-3;
}

// Голы — главное в хронике
.event--goal {
  color: $color-text;

  .event__player {
    font-weight: 600;
  }

  .event__note {
    font-weight: 400;
  }

  .event__minute {
    color: $color-accent-dark;
  }
}
</style>
