<script setup lang="ts">
import type { Match } from '~/types'

const props = defineProps<{ match: Match }>()

const kind = computed(() => getMatchStatusKind(props.match.status))
const winner = computed(() => kind.value === 'finished' ? getMatchWinnerSide(props.match) : null)

function resultFor(side: 'home' | 'away'): 'win' | 'lose' | null {
  if (!winner.value) return null
  return winner.value === side ? 'win' : 'lose'
}

// Левая колонка: у идущего матча — минута или период, у остальных — время начала
const stateLabel = computed(() => {
  if (kind.value === 'live') {
    return props.match.progress != null ? `${props.match.progress}′` : formatMatchStatus(props.match.status)
  }
  return formatMoscowTime(props.match.timestamp)
})

const subLabel = computed(() => {
  if (kind.value === 'live') return props.match.progress != null && props.match.status === 'ET' ? 'ДВ' : ''
  if (kind.value === 'finished') return 'Завершён'
  if (kind.value === 'inactive') return formatMatchStatus(props.match.status)
  return ''
})
</script>

<template>
  <NuxtLink
    :to="`/match/${match.idEvent}`"
    class="match"
    :class="`match--${kind}`"
  >
    <span class="match__meta">
      <span class="match__state">
        <span
          v-if="kind === 'live'"
          class="match__dot"
          aria-hidden="true"
        />
        {{ stateLabel }}
      </span>
      <span
        v-if="subLabel"
        class="match__sub"
      >{{ subLabel }}</span>
    </span>

    <MatchTeam
      side="home"
      :name="match.homeTeam"
      :badge="match.homeBadge"
      :result="resultFor('home')"
      :muted="kind === 'inactive'"
    />
    <MatchScore
      :home-score="match.homeScore"
      :away-score="match.awayScore"
      :home-pen-score="match.homePenScore"
      :away-pen-score="match.awayPenScore"
      :status="match.status"
    />
    <MatchTeam
      side="away"
      :name="match.awayTeam"
      :badge="match.awayBadge"
      :result="resultFor('away')"
      :muted="kind === 'inactive'"
    />
  </NuxtLink>
</template>

<style scoped lang="scss">
// Телефон: две строки (хозяева и гости), время слева на обе строки.
// Десктоп: одна строка «время · хозяева · счёт · гости»; вторая строка сетки
// нужна только под пометку «пен. 4:3» под плашкой счёта.
.match {
  display: grid;
  grid-template-columns: 56px 22px minmax(0, 1fr) auto;
  grid-template-areas:
    'meta hbadge hname hscore'
    'meta abadge aname ascore';
  column-gap: 10px;
  row-gap: 6px;
  align-items: center;
  padding: 12px 14px;
  color: $color-text;
  font-variant-numeric: tabular-nums;
  transition: background-color 0.15s;

  &:hover {
    background: $color-surface-hover;
  }
}

.match__meta {
  grid-area: meta;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.match__state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: $color-text-2;
}

.match__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: $color-live;
  box-shadow: 0 0 0 3px $color-live-soft;
}

.match__sub {
  font-size: 11px;
  color: $color-text-3;
}

.match--live .match__state {
  color: $color-live;
}

.match--inactive {
  .match__state {
    color: $color-text-muted;
  }

  .match__sub {
    color: $color-live;
  }
}

@media (min-width: $breakpoint-desktop) {
  .match {
    grid-template-columns: 84px minmax(0, 1fr) 96px minmax(0, 1fr);
    grid-template-areas:
      'meta home score away'
      'meta home note away';
    column-gap: 16px;
    row-gap: 0;
    align-content: center;
    min-height: 60px;
    padding: 10px 20px;
  }

  .match__state {
    font-size: 14px;
  }
}
</style>
