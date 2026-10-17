<script setup lang="ts">
import type { MatchGoal } from '~/types'

defineProps<{ goals: MatchGoal[] }>()

const NOTES: Partial<Record<MatchGoal['kind'], string>> = {
  'penalty': 'пен.',
  'own-goal': 'авт.',
}
</script>

<template>
  <section
    class="goals"
    aria-labelledby="goals-title"
  >
    <h2
      id="goals-title"
      class="goals__title"
    >
      Голы
    </h2>
    <!-- Как в шапке: голы хозяев слева, гостей справа, минута посередине -->
    <ul class="goals__list">
      <li
        v-for="(goal, index) in goals"
        :key="index"
        class="goal"
        :class="`goal--${goal.side}`"
      >
        <span class="goal__player">
          {{ goal.player }}<span
            v-if="NOTES[goal.kind]"
            class="goal__note"
          > ({{ NOTES[goal.kind] }})</span>
        </span>
        <span class="goal__minute">{{ goal.minute }}′</span>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.goals {
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

.goals__title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: $color-text-2;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.goals__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.goal {
  display: grid;
  grid-template-columns: 1fr 44px 1fr;
  align-items: baseline;
  font-size: 14px;
  color: $color-text;
}

.goal__minute {
  grid-column: 2;
  grid-row: 1;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 700;
  color: $color-accent-dark;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.goal__player {
  grid-row: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.goal--home .goal__player {
  grid-column: 1;
  text-align: right;
}

.goal--away .goal__player {
  grid-column: 3;
}

.goal__note {
  color: $color-text-3;
}
</style>
