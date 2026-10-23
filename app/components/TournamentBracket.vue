<script setup lang="ts">
import type { BracketRound, BracketTie } from '~/types'

const props = defineProps<{
  rounds: BracketRound[]
  /** Матч за 3-е место: отдельной карточкой под финалом */
  thirdPlace?: BracketTie | null
}>()

// Размеры сетки в пикселях. Пять раундов из одиночных матчей (1/16 … финал) ровно занимают ширину
// контента: 5 × 144 + 4 × 20 = 800. В парах из двух матчей есть ещё счёт каждого матча: карточки шире,
// чтобы влезали названия, и сетка ЛЧ (5 × 176 + 4 × 20 = 960) прокручивается вбок и на компьютере
const CARD_HEIGHT = 56
const CARD_WIDTH = 144
const TWO_LEGGED_CARD_WIDTH = 176
const CARD_GAP = 8 // между карточками первого раунда
const CONNECTOR_WIDTH = 20 // колонка с линиями между раундами
const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP
const THIRD_PLACE_GAP = 40 // от финала до матча за 3-е место; подпись в 12px под финалом

const firstRoundTieCount = computed(() => props.rounds[0]?.ties.length ?? 0)
const cardWidth = computed(() => props.rounds.some(round => round.ties.some(tie => tie.teams[0].goals.length > 1))
  ? TWO_LEGGED_CARD_WIDTH
  : CARD_WIDTH)
const totalWidth = computed(() => props.rounds.length * cardWidth.value + Math.max(0, props.rounds.length - 1) * CONNECTOR_WIDTH)
const thirdPlaceTop = computed(() => tieTopOffset(props.rounds.length - 1, 0) + CARD_HEIGHT + THIRD_PLACE_GAP)
const totalHeight = computed(() => Math.max(
  firstRoundTieCount.value * ROW_HEIGHT - CARD_GAP,
  props.thirdPlace ? thirdPlaceTop.value + CARD_HEIGHT : 0,
))

// Карточка встаёт посередине между парами, откуда в неё приходят победители: в раунде, где пар вдвое
// меньше, чем в первом, на пару приходится две строки первого раунда, где вчетверо меньше — четыре.
// После раунда плей-офф ЛЧ/ЛЕ/ЛК в 1/8 пар столько же, и карточки стоят друг напротив друга.
function tieTopOffset(roundIndex: number, tieIndex: number): number {
  const rowsPerTie = firstRoundTieCount.value / (props.rounds[roundIndex]?.ties.length || 1)
  return ((rowsPerTie - 1) / 2 + tieIndex * rowsPerTie) * ROW_HEIGHT
}

function columnLeft(roundIndex: number): number {
  return roundIndex * (cardWidth.value + CONNECTOR_WIDTH)
}

function connectorPath(roundIndex: number): string {
  const tieCount = props.rounds[roundIndex]!.ties.length
  const nextTieCount = props.rounds[roundIndex + 1]!.ties.length
  const centerY = (tieIndex: number) => tieTopOffset(roundIndex, tieIndex) + CARD_HEIGHT / 2

  // Пар столько же: прямая линия к паре напротив
  if (nextTieCount === tieCount) {
    return Array.from({ length: tieCount }, (_, tieIndex) => `M0,${centerY(tieIndex)}H${CONNECTOR_WIDTH}`).join(' ')
  }

  const centerX = CONNECTOR_WIDTH / 2
  return Array.from({ length: nextTieCount }, (_, pairIndex) => {
    const topY = centerY(2 * pairIndex)
    const bottomY = centerY(2 * pairIndex + 1)
    return `M0,${topY}H${centerX}V${bottomY}H0M${centerX},${(topY + bottomY) / 2}H${CONNECTOR_WIDTH}`
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
        <BracketTieCard
          v-for="(tie, tieIndex) in round.ties"
          :key="tie.id"
          :tie="tie"
          :projected="round.projected"
          class="bracket__tie"
          :style="{ top: tieTopOffset(roundIndex, tieIndex) + 'px', height: CARD_HEIGHT + 'px' }"
        />

        <template v-if="thirdPlace && roundIndex === rounds.length - 1">
          <p
            class="bracket__title bracket__title--third-place"
            :style="{ top: thirdPlaceTop - THIRD_PLACE_GAP + 12 + 'px' }"
          >
            Матч за 3-е место
          </p>
          <BracketTieCard
            :tie="thirdPlace"
            class="bracket__tie"
            :style="{ top: thirdPlaceTop + 'px', height: CARD_HEIGHT + 'px' }"
          />
        </template>
      </div>

      <!-- Линии от пар к паре следующего раунда -->
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
          <path :d="connectorPath(roundIndex)" />
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

.bracket__tie {
  position: absolute;
  width: 100%;
}

.bracket__title--third-place {
  position: absolute;
  width: 100%;
  margin: 0;
}
</style>
