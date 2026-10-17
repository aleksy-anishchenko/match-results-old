<script setup lang="ts">
import type { BracketRound } from '~/types'

const props = defineProps<{ rounds: BracketRound[] }>()

// Размеры сетки в пикселях. Пять раундов (1/16 … финал) ровно занимают ширину контента: 5 × 144 + 4 × 20 = 800
const CARD_HEIGHT = 56
const CARD_WIDTH = 144
const CARD_GAP = 8 // между карточками первого раунда
const CONNECTOR_WIDTH = 20 // колонка с линиями между раундами
const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP

const firstRoundMatchCount = computed(() => props.rounds[0]?.matches.length ?? 0)
const totalHeight = computed(() => firstRoundMatchCount.value * ROW_HEIGHT - CARD_GAP)
const totalWidth = computed(() => props.rounds.length * CARD_WIDTH + Math.max(0, props.rounds.length - 1) * CONNECTOR_WIDTH)

// Каждый следующий раунд занимает по высоте вдвое больше строк, чем предыдущий:
// в матч приходят победители двух матчей прошлого раунда, карточка встаёт посередине между ними.
function matchTopOffset(roundIndex: number, matchIndex: number): number {
  const rowsPerMatch = 2 ** roundIndex
  return ((rowsPerMatch - 1) / 2 + matchIndex * rowsPerMatch) * ROW_HEIGHT
}

function columnLeft(roundIndex: number): number {
  return roundIndex * (CARD_WIDTH + CONNECTOR_WIDTH)
}

function connectorPath(roundIndex: number, nextRoundMatchCount: number): string {
  const centerX = CONNECTOR_WIDTH / 2
  return Array.from({ length: nextRoundMatchCount }, (_, pairIndex) => {
    const topMatchCenterY = matchTopOffset(roundIndex, 2 * pairIndex) + CARD_HEIGHT / 2
    const bottomMatchCenterY = matchTopOffset(roundIndex, 2 * pairIndex + 1) + CARD_HEIGHT / 2
    const midpointY = (topMatchCenterY + bottomMatchCenterY) / 2
    return `M0,${topMatchCenterY}H${centerX}V${bottomMatchCenterY}H0M${centerX},${midpointY}H${CONNECTOR_WIDTH}`
  }).join(' ')
}
</script>

<template>
  <div
    v-if="rounds.length"
    class="bracket"
  >
    <div
      class="bracket__header"
      :style="{ width: totalWidth + 'px', gap: CONNECTOR_WIDTH + 'px' }"
    >
      <div
        v-for="(round, roundIndex) in rounds"
        :key="roundIndex"
        class="bracket__title"
        :style="{ width: CARD_WIDTH + 'px' }"
      >
        {{ round.name }}
      </div>
    </div>

    <div
      class="bracket__body"
      :style="{ width: totalWidth + 'px', height: totalHeight + 'px' }"
    >
      <div
        v-for="(round, roundIndex) in rounds"
        :key="'col-' + roundIndex"
        class="bracket__column"
        :style="{ left: columnLeft(roundIndex) + 'px', width: CARD_WIDTH + 'px' }"
      >
        <div
          v-for="(match, matchIndex) in round.matches"
          :key="match.idEvent"
          class="bracket-match"
          :class="{ 'bracket-match--projected': round.projected }"
          :style="{ top: matchTopOffset(roundIndex, matchIndex) + 'px', height: CARD_HEIGHT + 'px' }"
        >
          <div
            class="bracket-match__team"
            :class="{
              'bracket-match__team--win': getMatchWinnerSide(match) === 'home',
              'bracket-match__team--lose': getMatchWinnerSide(match) === 'away',
              'bracket-match__team--tbd': !match.homeTeam,
            }"
          >
            <img
              v-if="match.homeBadge"
              :src="getBadgeUrl(match.homeBadge)"
              alt=""
              width="18"
              height="18"
              class="bracket-match__badge"
            >
            <span
              v-else
              class="bracket-match__badge bracket-match__badge--empty"
            />
            <span class="bracket-match__name">{{ getTeamName(match.homeTeam) || 'Не определен' }}</span>
            <span
              v-if="FINISHED_MATCH_STATUSES.has(match.status) && match.homeScore !== null"
              class="bracket-match__score"
            >
              {{ match.homeScore }}<sup
                v-if="match.homePenScore != null"
                class="bracket-match__pen"
              >{{ match.homePenScore }}</sup>
            </span>
          </div>

          <div
            class="bracket-match__team"
            :class="{
              'bracket-match__team--win': getMatchWinnerSide(match) === 'away',
              'bracket-match__team--lose': getMatchWinnerSide(match) === 'home',
              'bracket-match__team--tbd': !match.awayTeam,
            }"
          >
            <img
              v-if="match.awayBadge"
              :src="getBadgeUrl(match.awayBadge)"
              alt=""
              width="18"
              height="18"
              class="bracket-match__badge"
            >
            <span
              v-else
              class="bracket-match__badge bracket-match__badge--empty"
            />
            <span class="bracket-match__name">{{ getTeamName(match.awayTeam) || 'Не определен' }}</span>
            <span
              v-if="FINISHED_MATCH_STATUSES.has(match.status) && match.awayScore !== null"
              class="bracket-match__score"
            >
              {{ match.awayScore }}<sup
                v-if="match.awayPenScore != null"
                class="bracket-match__pen"
              >{{ match.awayPenScore }}</sup>
            </span>
          </div>
        </div>
      </div>

      <!-- Линии от пары матчей к матчу следующего раунда -->
      <template
        v-for="(_, roundIndex) in rounds"
        :key="'conn-' + roundIndex"
      >
        <svg
          v-if="roundIndex < rounds.length - 1"
          class="bracket__connector"
          :style="{ left: columnLeft(roundIndex) + CARD_WIDTH + 'px' }"
          :width="CONNECTOR_WIDTH"
          :height="totalHeight"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path :d="connectorPath(roundIndex, rounds[roundIndex + 1]!.matches.length)" />
        </svg>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Сетка бывает шире экрана и прокручивается вбок. Область прокрутки выходит под боковые
// отступы страницы (.container), чтобы карточки уезжали за край экрана, а не обрезались в 16px от него.
.bracket {
  margin: 0 (-$container-padding);
  padding: 0 $container-padding 24px;
  overflow-x: auto;

  @media (min-width: $breakpoint-desktop) {
    margin: 0 (-$container-padding-desktop);
    padding: 0 $container-padding-desktop 24px;
  }
}

.bracket__header {
  display: flex;
  padding-bottom: 12px;
}

.bracket__title {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: $color-text-2;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.bracket__body {
  position: relative;
}

.bracket__column {
  position: absolute;
  top: 0;
}

.bracket__connector {
  position: absolute;
  top: 0;
  overflow: visible;

  path {
    fill: none;
    stroke: $color-border-strong;
    stroke-width: 1.5;
  }
}

.bracket-match {
  position: absolute;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card-sm;
  overflow: hidden;
}

// Будущий матч, пары ещё нет
.bracket-match--projected {
  background: transparent;
  border-style: dashed;
  border-color: $color-border-strong;
}

.bracket-match__team {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: $color-text;

  & + & {
    border-top: 1px solid $color-border-soft;
  }

  &--win {
    font-weight: 700;
  }

  &--lose {
    color: $color-text-3;
  }

  &--tbd {
    color: $color-text-muted;
  }
}

.bracket-match--projected .bracket-match__team + .bracket-match__team {
  border-top-style: dashed;
  border-top-color: $color-border;
}

.bracket-match__badge {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  object-fit: contain;

  &--empty {
    border-radius: 50%;
    background: $color-badge-bg;
    border: 1px solid $color-border;
  }
}

.bracket-match__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bracket-match__score {
  flex-shrink: 0;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 700;
  color: $color-accent-dark;
  font-variant-numeric: tabular-nums;
}

.bracket-match__pen {
  margin-left: 1px;
  font-family: $font-text;
  font-size: 10px;
  font-weight: 600;
  color: $color-text-3;
}
</style>
