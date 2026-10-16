<script setup lang="ts">
import type { StandingsResponse, BracketResponse, GroupStanding } from '~/types'

useHead({ title: 'Турнирная таблица' })

const { competition } = useCompetition()

const isTournament = computed(() => competition.value.type === 'tournament')
const activeTab = ref<'playoff' | 'groups'>('playoff')

const leagueQuery = computed(() => ({ leagueId: competition.value.id }))

const { data: standingsData, error: standingsError } = await useFetch<StandingsResponse>('/api/standings', {
  query: leagueQuery,
})

const { data: bracketData, error: bracketError } = await useFetch<BracketResponse>('/api/bracket', {
  query: leagueQuery,
})

const groups = computed(() => standingsData.value?.groups ?? {})
const rounds = computed(() => bracketData.value?.rounds ?? [])

const isGroupStage = computed(() => isTournament.value && Object.keys(groups.value).length > 1)

const secondTabLabel = computed(() => isGroupStage.value ? 'Группы' : 'Таблица')

const advancedTeams = computed(() => {
  if (!isGroupStage.value) return null
  const roundOf32 = bracketData.value?.rounds.find(round => !round.projected)
  if (!roundOf32) return null
  const teams = new Set<string>()
  for (const match of roundOf32.matches) {
    if (match.homeTeam) teams.add(match.homeTeam)
    if (match.awayTeam) teams.add(match.awayTeam)
  }
  return teams
})

// Зоны лиг приходят из API. В группах турнира зону считаем сами: кто выходит в плей-офф
const tables = computed(() => Object.entries(groups.value).map(([name, rows]) => ({
  name,
  rows: isGroupStage.value
    ? rows.map((row, index): GroupStanding => ({
        ...row,
        zone: getGroupStageZone(row.team, index, {
          advancedTeams: advancedTeams.value,
          groupAdvance: competition.value.groupAdvance,
          bestThirdsAdvance: competition.value.bestThirdsAdvance,
        }),
      }))
    : rows,
})))

const legend = computed(() => collectLegend(tables.value.flatMap(table => table.rows)))

const kicker = computed(() => {
  const season = standingsData.value?.season
  return season ? `${competition.value.name} · сезон ${formatSeason(season)}` : competition.value.name
})
</script>

<template>
  <div class="standings-page">
    <header class="page-head">
      <p class="page-head__kicker">
        {{ kicker }}
      </p>
      <h1 class="page-head__title">
        Таблица
      </h1>
    </header>

    <div
      v-if="isTournament"
      class="tabs"
    >
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'playoff' }"
        @click="activeTab = 'playoff'"
      >
        Плей-офф
      </button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'groups' }"
        @click="activeTab = 'groups'"
      >
        {{ secondTabLabel }}
      </button>
    </div>

    <template v-if="isTournament && activeTab === 'playoff'">
      <p
        v-if="bracketError"
        class="status"
      >
        Не удалось загрузить сетку плей-офф. Попробуйте обновить страницу.
      </p>
      <p
        v-else-if="!rounds.length"
        class="status"
      >
        Плей-офф ещё не начался
      </p>
      <TournamentBracket
        v-else
        :rounds="rounds"
      />
    </template>

    <template v-else>
      <p
        v-if="standingsError"
        class="status"
      >
        Не удалось загрузить таблицу. Попробуйте обновить страницу.
      </p>
      <p
        v-else-if="!tables.length"
        class="status"
      >
        Таблицы пока нет
      </p>
      <div
        v-else
        class="groups"
      >
        <!-- Заголовок нужен, когда таблиц несколько: группы турнира, конференции МЛС -->
        <StandingsTable
          v-for="table in tables"
          :key="table.name"
          :rows="table.rows"
          :title="tables.length > 1 ? table.name : undefined"
        />
      </div>
      <ul
        v-if="legend.length"
        class="legend"
      >
        <li
          v-for="zone in legend"
          :key="zone.label"
          class="legend__item"
        >
          <StandingZoneMark
            :kind="zone.kind"
            variant="square"
          />
          {{ zone.label }}
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped lang="scss">
.standings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.page-head {
  display: flex;
  flex-direction: column;
  gap: 4px;

  @media (min-width: $breakpoint-desktop) {
    gap: 6px;
  }
}

.page-head__kicker {
  font-size: 12px;
  font-weight: 600;
  color: $color-text-3;
  text-transform: uppercase;
  letter-spacing: 0.08em;

  @media (min-width: $breakpoint-desktop) {
    font-size: 13px;
  }
}

.page-head__title {
  font-size: 28px;
  line-height: 1.2;

  @media (min-width: $breakpoint-desktop) {
    font-size: 40px;
  }
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #eee;
}

.tab {
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: #333;
  }

  &--active {
    color: #111;
    border-bottom-color: #111;
  }
}

.status {
  padding: 24px 0;
  font-size: 14px;
  color: $color-text-3;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 13px;
  color: $color-text-2;

  @media (min-width: $breakpoint-desktop) {
    font-size: 14px;
  }
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
