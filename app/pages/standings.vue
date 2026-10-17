<script setup lang="ts">
import type { StandingsResponse, BracketResponse, GroupStanding } from '~/types'

useHead({ title: 'Турнирная таблица' })

const { competition } = useCompetition()

type Tab = 'playoff' | 'groups'

const isTournament = computed(() => competition.value.type === 'tournament')
const activeTab = ref<Tab>('playoff')

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

const tabs = computed<Array<{ value: Tab, label: string }>>(() => [
  { value: 'playoff', label: 'Плей-офф' },
  { value: 'groups', label: isGroupStage.value ? 'Группы' : 'Таблица' },
])

const tabId = (tab: Tab) => `standings-tab-${tab}`

// Клавиатура как у обычных вкладок (role="tablist"): Tab попадает только на выбранную,
// стрелки и Home/End переключают вкладку и переносят на неё фокус
function onTabKeydown(event: KeyboardEvent) {
  const currentIndex = tabs.value.findIndex(tab => tab.value === activeTab.value)
  const targets: Record<string, number> = {
    ArrowLeft: currentIndex - 1,
    ArrowRight: currentIndex + 1,
    Home: 0,
    End: tabs.value.length - 1,
  }
  const targetIndex = targets[event.key]
  if (targetIndex === undefined) return
  event.preventDefault()
  const count = tabs.value.length
  const target = tabs.value[(targetIndex + count) % count]!
  activeTab.value = target.value
  document.getElementById(tabId(target.value))?.focus()
}

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
      role="tablist"
      aria-label="Раздел таблицы"
    >
      <button
        v-for="tab in tabs"
        :id="tabId(tab.value)"
        :key="tab.value"
        type="button"
        role="tab"
        class="tabs__pill"
        :class="{ 'tabs__pill--active': activeTab === tab.value }"
        :aria-selected="activeTab === tab.value"
        aria-controls="standings-panel"
        :tabindex="activeTab === tab.value ? 0 : -1"
        @click="activeTab = tab.value"
        @keydown="onTabKeydown"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- У турнира содержимое показывается под вкладками и подписано выбранной вкладкой -->
    <div
      id="standings-panel"
      class="panel"
      :role="isTournament ? 'tabpanel' : undefined"
      :aria-labelledby="isTournament ? tabId(activeTab) : undefined"
    >
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
  gap: 8px;
}

.tabs__pill {
  @include pill-button;

  &--active {
    @include pill-button-active;
  }
}

// Таблицы и легенда внутри панели стоят с тем же шагом, что и блоки страницы
.panel {
  display: flex;
  flex-direction: column;
  gap: inherit;
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
