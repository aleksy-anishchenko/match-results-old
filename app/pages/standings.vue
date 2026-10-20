<script setup lang="ts">
import type { StandingsResponse, BracketResponse } from '~/types'

useHead({ title: 'Турнирная таблица' })

const { competition } = useCompetition()

type Tab = 'playoff' | 'table'

const isTournament = computed(() => competition.value.type === 'tournament')

const leagueQuery = computed(() => ({ leagueId: competition.value.id }))

const { data: standingsData, error: standingsError } = await useFetch<StandingsResponse>('/api/standings', {
  query: leagueQuery,
})

const { data: bracketData, error: bracketError } = await useFetch<BracketResponse>('/api/bracket', {
  query: leagueQuery,
})

const groups = computed(() => standingsData.value?.groups ?? {})
const rounds = computed(() => bracketData.value?.rounds ?? [])

// Пока сетки нет (идёт общий или групповой этап), сразу открываем таблицу.
// Выбор пользователя важнее, но при смене турнира он сбрасывается.
const selectedTab = ref<Tab | null>(null)
const activeTab = computed<Tab>(() => selectedTab.value ?? (rounds.value.length ? 'playoff' : 'table'))
watch(() => competition.value.id, () => {
  selectedTab.value = null
})

const tabs = computed<Array<{ value: Tab, label: string }>>(() => [
  { value: 'playoff', label: 'Плей-офф' },
  { value: 'table', label: 'Таблица' },
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
  selectedTab.value = target.value
  document.getElementById(tabId(target.value))?.focus()
}

// Зоны (еврокубки, вылет) приходят из API вместе с таблицей, только у лиг
const tables = computed(() => Object.entries(groups.value).map(([name, rows]) => ({ name, rows })))

const legend = computed(() => collectLegend(tables.value.flatMap(table => table.rows)))
</script>

<template>
  <div class="standings-page">
    <!-- Раздел и лига видны в полосе ниже; заголовок нужен экранному диктору и поисковикам -->
    <h1 class="visually-hidden">
      Таблица: {{ competition.name }}
    </h1>

    <CompetitionBar />

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
        @click="selectedTab = tab.value"
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
          :third-place="bracketData?.thirdPlace"
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
