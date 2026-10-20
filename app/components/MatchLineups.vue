<script setup lang="ts">
import type { MatchLineups } from '~/types'

const props = defineProps<{
  lineups: MatchLineups
  homeTeam: string
  awayTeam: string
}>()

// Как в хронике: хозяева слева, гости справа
const teams = computed(() => [
  { side: 'home', name: getTeamName(props.homeTeam), lineup: props.lineups.home },
  { side: 'away', name: getTeamName(props.awayTeam), lineup: props.lineups.away },
] as const)
</script>

<template>
  <section
    class="lineups"
    aria-labelledby="lineups-title"
  >
    <h2
      id="lineups-title"
      class="lineups__title"
    >
      Составы
    </h2>
    <!-- Одна сетка на обе команды: «Запасные» и тренеры стоят на одной высоте, даже если линий у команд разное число -->
    <div class="lineups__grid">
      <p
        v-for="team in teams"
        :key="`title-${team.side}`"
        class="lineup__team"
      >
        <span class="lineup__name">{{ team.name }}</span>
        <span
          v-if="team.lineup.formation"
          class="lineup__formation num"
        >{{ team.lineup.formation }}</span>
      </p>

      <div
        v-for="team in teams"
        :key="`start-${team.side}`"
        class="lineup__start"
      >
        <ul
          v-for="(line, index) in team.lineup.lines"
          :key="index"
          class="lineup__players"
        >
          <li
            v-for="(player, place) in line"
            :key="place"
            class="player"
          >
            <span class="player__number num">{{ player.number }}</span>
            <span class="player__name">{{ player.name }}</span>
          </li>
        </ul>
      </div>

      <h3 class="lineups__subtitle">
        Запасные
      </h3>
      <ul
        v-for="team in teams"
        :key="`subs-${team.side}`"
        class="lineup__players"
      >
        <li
          v-for="(player, place) in team.lineup.substitutes"
          :key="place"
          class="player player--sub"
        >
          <span class="player__number num">{{ player.number }}</span>
          <span class="player__name">{{ player.name }}</span>
        </li>
      </ul>

      <p
        v-for="team in teams"
        :key="`coach-${team.side}`"
        class="lineup__coach"
      >
        <template v-if="team.lineup.coach">
          Тренер: {{ team.lineup.coach }}
        </template>
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lineups {
  @include match-section;
}

.lineups__title,
.lineups__subtitle {
  @include match-section-title;
}

.lineups__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 12px;

  @media (min-width: $breakpoint-desktop) {
    column-gap: 32px;
  }
}

.lineups__subtitle {
  grid-column: 1 / -1;
  margin-top: 4px;
}

.lineup__team {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: $color-text;
}

.lineup__formation {
  font-size: 13px;
  font-weight: 600;
  color: $color-accent-dark;
}

// Линии отделены просветом: вратарь, защитники, полузащитники, нападающие
.lineup__start {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lineup__players {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.player {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  column-gap: 6px;
  align-items: baseline;
  font-size: 14px;
  color: $color-text;
}

.player__number {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-3;
  text-align: right;
}

.player__name {
  overflow-wrap: anywhere;
}

.player--sub {
  color: $color-text-2;
}

.lineup__coach {
  font-size: 13px;
  color: $color-text-3;
}
</style>
