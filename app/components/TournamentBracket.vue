<script setup lang="ts">
import type { BracketRound } from '~/types'

const props = defineProps<{ rounds: BracketRound[] }>()

// Layout constants — CARD_HEIGHT must match the CSS height value
const CARD_HEIGHT = 50
const CARD_WIDTH = 148
const CARD_GAP = 6 // gap between first-round cards
const CONNECTOR_WIDTH = 16 // width of connector column between rounds
const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP

const firstRoundMatchCount = computed(() => props.rounds[0]?.matches.length ?? 0)
const totalHeight = computed(() => firstRoundMatchCount.value * ROW_HEIGHT - CARD_GAP)
const totalWidth = computed(() => props.rounds.length * CARD_WIDTH + Math.max(0, props.rounds.length - 1) * CONNECTOR_WIDTH)

// Each round's matches span twice as many rows as the previous round's,
// since every match here is fed by two matches from the round before it.
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
    class="bs"
  >
    <!-- Round name headers -->
    <div
      class="bs-header"
      :style="{ width: totalWidth + 'px' }"
    >
      <template
        v-for="(round, roundIndex) in rounds"
        :key="roundIndex"
      >
        <div
          class="bs-title"
          :style="{ width: CARD_WIDTH + 'px' }"
        >
          {{ round.name }}
        </div>
        <div
          v-if="roundIndex < rounds.length - 1"
          :style="{ width: CONNECTOR_WIDTH + 'px', flexShrink: 0 }"
        />
      </template>
    </div>

    <!-- Bracket body -->
    <div
      class="bs-body"
      :style="{ width: totalWidth + 'px', height: totalHeight + 'px' }"
    >
      <!-- Match card columns -->
      <div
        v-for="(round, roundIndex) in rounds"
        :key="'col-' + roundIndex"
        class="bs-col"
        :style="{ left: columnLeft(roundIndex) + 'px', width: CARD_WIDTH + 'px' }"
      >
        <div
          v-for="(match, matchIndex) in round.matches"
          :key="match.idEvent"
          class="mc"
          :class="{ 'mc--proj': round.projected, 'mc--done': FINISHED_MATCH_STATUSES.has(match.status) }"
          :style="{ top: matchTopOffset(roundIndex, matchIndex) + 'px' }"
        >
          <!-- Home team row -->
          <div
            class="mc-team"
            :class="{
              'mc-team--win': getMatchWinnerSide(match) === 'home',
              'mc-team--lose': getMatchWinnerSide(match) === 'away',
              'mc-team--tbd': !match.homeTeam,
            }"
          >
            <img
              v-if="match.homeBadge"
              :src="getBadgeUrl(match.homeBadge)"
              width="16"
              height="16"
              class="mc-badge"
              :alt="match.homeTeam"
            >
            <span class="mc-name">{{ getTeamName(match.homeTeam) || 'Не определен' }}</span>
            <span
              v-if="FINISHED_MATCH_STATUSES.has(match.status) && match.homeScore !== null"
              class="mc-score"
            >
              {{ match.homeScore }}<sup
                v-if="match.homePenScore != null"
                class="mc-pen"
              >{{ match.homePenScore }}</sup>
            </span>
          </div>

          <div class="mc-sep" />

          <!-- Away team row -->
          <div
            class="mc-team"
            :class="{
              'mc-team--win': getMatchWinnerSide(match) === 'away',
              'mc-team--lose': getMatchWinnerSide(match) === 'home',
              'mc-team--tbd': !match.awayTeam,
            }"
          >
            <img
              v-if="match.awayBadge"
              :src="getBadgeUrl(match.awayBadge)"
              width="16"
              height="16"
              class="mc-badge"
              :alt="match.awayTeam"
            >
            <span class="mc-name">{{ getTeamName(match.awayTeam) || 'Не определен' }}</span>
            <span
              v-if="FINISHED_MATCH_STATUSES.has(match.status) && match.awayScore !== null"
              class="mc-score"
            >
              {{ match.awayScore }}<sup
                v-if="match.awayPenScore != null"
                class="mc-pen"
              >{{ match.awayPenScore }}</sup>
            </span>
          </div>
        </div>
      </div>

      <!-- SVG connectors between rounds -->
      <template
        v-for="(_, roundIndex) in rounds"
        :key="'conn-' + roundIndex"
      >
        <svg
          v-if="roundIndex < rounds.length - 1"
          class="bs-conn"
          :style="{ left: columnLeft(roundIndex) + CARD_WIDTH + 'px' }"
          :width="CONNECTOR_WIDTH"
          :height="totalHeight"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            :d="connectorPath(roundIndex, rounds[roundIndex + 1]!.matches.length)"
            stroke="#c8c8c8"
            stroke-width="1.5"
            fill="none"
          />
        </svg>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bs {
  overflow-x: auto;
  overflow-y: auto;
  padding-bottom: 40px;
  -webkit-overflow-scrolling: touch;
}

.bs-header {
  display: flex;
  padding-bottom: 10px;
}

.bs-title {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.bs-body {
  position: relative;
}

.bs-col {
  position: absolute;
  top: 0;
}

.bs-conn {
  position: absolute;
  top: 0;
  overflow: visible;
}

.mc {
  position: absolute;
  width: 100%;
  height: 50px; /* must match CARD_HEIGHT constant in script */
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  background: #fff;
  padding: 5px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
}

.mc--proj {
  border-style: dashed;
  border-color: #e0e0e0;
  background: #fafafa;
}

.mc--done {
  background: #f9f9f9;
}

.mc-team {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  min-width: 0;
}

.mc-team--win .mc-name {
  font-weight: 700;
}

.mc-team--lose {
  opacity: 0.38;
}

.mc-team--tbd .mc-name {
  color: #ccc;
  font-style: italic;
}

.mc-badge {
  flex-shrink: 0;
  object-fit: contain;
}

.mc-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.mc-score {
  font-weight: 700;
  font-size: 13px;
  min-width: 12px;
  text-align: right;
  flex-shrink: 0;
}

.mc-pen {
  font-size: 9px;
  font-weight: 500;
  color: #888;
  vertical-align: super;
}

.mc-sep {
  height: 1px;
  background: #f0f0f0;
  margin: 0 -8px;
}
</style>
