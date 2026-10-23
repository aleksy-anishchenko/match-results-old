<script setup lang="ts">
import { formatPenaltyScore, getMatchStatusKind } from '#shared/utils/matches'

const props = withDefaults(defineProps<{
  homeScore: number | null
  awayScore: number | null
  homePenScore?: number | null
  awayPenScore?: number | null
  status?: string
}>(), {
  homePenScore: null,
  awayPenScore: null,
  status: 'NS',
})

const kind = computed(() => getMatchStatusKind(props.status))
const hasScore = computed(() => props.homeScore != null || props.awayScore != null)

// Пометка под счётом: серия пенальти или победа в дополнительное время
const note = computed(() => {
  const penalties = formatPenaltyScore(props)
  if (penalties) return `пен. ${penalties}`
  if (props.status === 'AET') return 'после ДВ'
  return ''
})
</script>

<template>
  <div
    class="score"
    :class="`score--${kind}`"
  >
    <span class="score__pill">
      <template v-if="hasScore">
        <span class="score__goals score__goals--home">{{ homeScore ?? '–' }}</span>
        <span class="score__colon">:</span>
        <span class="score__goals score__goals--away">{{ awayScore ?? '–' }}</span>
      </template>
      <span
        v-else
        class="score__empty"
      >–</span>
    </span>
    <span
      v-if="note"
      class="score__note"
    >{{ note }}</span>
  </div>
</template>

<style scoped lang="scss">
// Корень компонента не создаёт свой бокс (display: contents): плашка и пометка
// становятся элементами сетки родительской строки и занимают в ней свои области.
// На телефоне «растворяется» и плашка: цифры счёта встают каждая в свою строку.
.score {
  display: contents;
}

.score__pill {
  display: contents;
}

.score__goals {
  font-family: $font-display;
  font-size: 15px;
  font-weight: 700;
  text-align: right;
  min-width: 22px;
  color: $color-text-muted;

  &--home {
    grid-area: hscore;
  }

  &--away {
    grid-area: ascore;
  }
}

.score--finished .score__goals {
  color: $color-accent-dark;
}

.score--live .score__goals {
  color: $color-live;
}

.score__colon,
.score__empty {
  display: none;
}

.score__note {
  grid-column: 2 / -1;
  font-size: 12px;
  font-weight: 600;
  color: $color-text-2;
}

@media (min-width: $breakpoint-desktop) {
  .score__pill {
    grid-area: score;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    min-width: 72px;
    padding: 0 8px;
    border-radius: $radius-score;
    background: $color-border-soft;
    color: $color-text-muted;
  }

  .score--finished .score__pill {
    background: $color-accent-soft;
    color: $color-accent-dark;
  }

  .score--live .score__pill {
    background: $color-live-soft;
    color: $color-live;
  }

  .score__goals {
    font-size: 16px;
    min-width: 0;
    text-align: center;
    color: inherit;
  }

  .score--finished .score__goals,
  .score--live .score__goals {
    color: inherit;
  }

  .score__colon,
  .score__empty {
    display: inline;
    font-family: $font-display;
    font-size: 16px;
    font-weight: 700;
  }

  .score__colon {
    color: $color-accent-muted;
  }

  .score--live .score__colon {
    color: $color-live-pale;
  }

  .score__note {
    grid-area: note;
    grid-column: auto;
    margin-top: 3px;
    font-size: 11px;
    text-align: center;
    white-space: nowrap;
  }
}
</style>
