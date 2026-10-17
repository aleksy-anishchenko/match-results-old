<script setup lang="ts">
import type { BracketRound } from '~/types'

const props = defineProps<{ rounds: BracketRound[] }>()

// Размеры сетки в пикселях. Пять раундов из одиночных матчей (1/16 … финал) ровно занимают ширину
// контента: 5 × 144 + 4 × 20 = 800. В парах из двух матчей есть ещё счёт каждого матча: карточки шире,
// чтобы влезали названия, и сетка ЛЧ (5 × 176 + 4 × 20 = 960) прокручивается вбок и на компьютере
const CARD_HEIGHT = 56
const CARD_WIDTH = 144
const TWO_LEGGED_CARD_WIDTH = 176
const CARD_GAP = 8 // между карточками первого раунда
const CONNECTOR_WIDTH = 20 // колонка с линиями между раундами
const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP

const firstRoundTieCount = computed(() => props.rounds[0]?.ties.length ?? 0)
const totalHeight = computed(() => firstRoundTieCount.value * ROW_HEIGHT - CARD_GAP)
const cardWidth = computed(() => props.rounds.some(round => round.ties.some(tie => tie.teams[0].goals.length > 1))
  ? TWO_LEGGED_CARD_WIDTH
  : CARD_WIDTH)
const totalWidth = computed(() => props.rounds.length * cardWidth.value + Math.max(0, props.rounds.length - 1) * CONNECTOR_WIDTH)

// Каждый следующий раунд занимает по высоте вдвое больше строк, чем предыдущий:
// в пару приходят победители двух пар прошлого раунда, карточка встаёт посередине между ними.
function tieTopOffset(roundIndex: number, tieIndex: number): number {
  const rowsPerTie = 2 ** roundIndex
  return ((rowsPerTie - 1) / 2 + tieIndex * rowsPerTie) * ROW_HEIGHT
}

function columnLeft(roundIndex: number): number {
  return roundIndex * (cardWidth.value + CONNECTOR_WIDTH)
}

function connectorPath(roundIndex: number, nextRoundTieCount: number): string {
  const centerX = CONNECTOR_WIDTH / 2
  return Array.from({ length: nextRoundTieCount }, (_, pairIndex) => {
    const topTieCenterY = tieTopOffset(roundIndex, 2 * pairIndex) + CARD_HEIGHT / 2
    const bottomTieCenterY = tieTopOffset(roundIndex, 2 * pairIndex + 1) + CARD_HEIGHT / 2
    const midpointY = (topTieCenterY + bottomTieCenterY) / 2
    return `M0,${topTieCenterY}H${centerX}V${bottomTieCenterY}H0M${centerX},${midpointY}H${CONNECTOR_WIDTH}`
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
        :style="{ width: cardWidth + 'px' }"
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
        :style="{ left: columnLeft(roundIndex) + 'px', width: cardWidth + 'px' }"
      >
        <div
          v-for="(tie, tieIndex) in round.ties"
          :key="tie.id"
          class="bracket-match"
          :class="{ 'bracket-match--projected': round.projected }"
          :style="{ top: tieTopOffset(roundIndex, tieIndex) + 'px', height: CARD_HEIGHT + 'px' }"
        >
          <div
            v-for="(team, side) in tie.teams"
            :key="side"
            class="bracket-match__team"
            :class="{
              'bracket-match__team--win': tie.winner === side,
              'bracket-match__team--lose': tie.winner != null && tie.winner !== side,
              'bracket-match__team--tbd': !team.name,
            }"
          >
            <img
              v-if="team.badge"
              :src="getBadgeUrl(team.badge)"
              alt=""
              width="18"
              height="18"
              class="bracket-match__badge"
            >
            <span
              v-else
              class="bracket-match__badge bracket-match__badge--empty"
            />
            <span class="bracket-match__name">{{ getTeamName(team.name) || 'Не определен' }}</span>
            <!-- В паре из двух матчей: мелко голы в каждом сыгранном матче, крупно сумма -->
            <span
              v-if="team.goals.length > 1"
              class="bracket-match__legs"
            >
              <span
                v-for="(goals, leg) in team.goals"
                v-show="goals != null"
                :key="leg"
                class="bracket-match__leg"
              >{{ goals }}</span>
            </span>
            <span
              v-if="getTieTotal(team) != null"
              class="bracket-match__score"
            >
              {{ getTieTotal(team) }}<sup
                v-if="team.penalties != null"
                class="bracket-match__pen"
              >{{ team.penalties }}</sup>
            </span>
          </div>
        </div>
      </div>

      <!-- Линии от двух пар к паре следующего раунда -->
      <template
        v-for="(_, roundIndex) in rounds"
        :key="'conn-' + roundIndex"
      >
        <svg
          v-if="roundIndex < rounds.length - 1"
          class="bracket__connector"
          :style="{ left: columnLeft(roundIndex) + cardWidth + 'px' }"
          :width="CONNECTOR_WIDTH"
          :height="totalHeight"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path :d="connectorPath(roundIndex, rounds[roundIndex + 1]!.ties.length)" />
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

.bracket-match__legs {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: $color-text-3;
  font-variant-numeric: tabular-nums;
}

.bracket-match__leg {
  min-width: 7px;
  text-align: center;
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
