<script setup lang="ts">
import type { MatchesResponse, RoundsResponse } from '~/types'

const { competition } = useCompetition()
const route = useRoute()
const router = useRouter()

const leagueId = computed(() => competition.value.id)

// Что показано, хранится в адресе: ?round=5 — тур, ?from=…&to=… — даты, без параметров — текущий тур.
// Так «назад» со страницы матча возвращает туда же, откуда ушли
const queryValue = (value: unknown) => typeof value === 'string' && value ? value : null
const dateRange = computed(() => {
  const from = queryValue(route.query.from)
  return from ? { from, to: queryValue(route.query.to) ?? from } : null
})

const { data: roundsData } = await useFetch<RoundsResponse>('/api/rounds', {
  query: computed(() => ({ leagueId: leagueId.value })),
})

const rounds = computed(() => roundsData.value?.rounds ?? [])
const roundId = computed(() => queryValue(route.query.round) ?? roundsData.value?.current ?? null)
const roundIndex = computed(() => rounds.value.findIndex(round => round.id === roundId.value))
const round = computed(() => rounds.value[roundIndex.value])
const previousRound = computed(() => roundIndex.value > 0 ? rounds.value[roundIndex.value - 1] : undefined)
const nextRound = computed(() => roundIndex.value >= 0 ? rounds.value[roundIndex.value + 1] : undefined)

// Без туров (сезона нет в API) сервер покажет матчи за сегодня
const { data, pending, error } = await useFetch<MatchesResponse>('/api/matches', {
  query: computed(() => dateRange.value
    ? { leagueId: leagueId.value, dateFrom: dateRange.value.from, dateTo: dateRange.value.to }
    : { leagueId: leagueId.value, round: round.value?.id ?? '' }),
})

const groupedMatches = computed(() =>
  groupMatchesByDate(data.value?.matches ?? []),
)

const kicker = computed(() => {
  const season = roundsData.value?.season
  return season ? `${competition.value.name} · сезон ${formatSeason(season)}` : competition.value.name
})

const title = computed(() => {
  if (dateRange.value) return formatDatesTitle(dateRange.value.from, dateRange.value.to, getMoscowDate(new Date()))
  return round.value?.name ?? 'Сегодня'
})

// replace, а не push: стрелки и фильтр не засоряют историю, «назад» уводит со страницы
function showRound(id?: string) {
  router.replace({ query: id ? { round: id } : {} })
}

function showDates(range: { from: string, to: string }) {
  router.replace({ query: range })
}

// У другого турнира свои туры: показываем его текущий
watch(leagueId, () => showRound())
</script>

<template>
  <div class="home-page">
    <header class="page-head">
      <div class="page-head__text">
        <p class="page-head__kicker">
          {{ kicker }}
        </p>
        <h1 class="page-head__title">
          {{ title }}
        </h1>
      </div>
      <div
        v-if="!dateRange && round"
        class="page-head__arrows"
      >
        <button
          type="button"
          class="arrow"
          :disabled="!previousRound"
          :aria-label="previousRound ? `Назад: ${previousRound.name}` : 'Назад'"
          @click="showRound(previousRound?.id)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          class="arrow"
          :disabled="!nextRound"
          :aria-label="nextRound ? `Вперёд: ${nextRound.name}` : 'Вперёд'"
          @click="showRound(nextRound?.id)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </header>

    <AppFilter
      :range="dateRange"
      @round="showRound()"
      @range="showDates"
    />

    <p
      v-if="pending"
      class="status"
    >
      Загрузка...
    </p>
    <p
      v-else-if="error"
      class="status"
    >
      Не удалось загрузить матчи. Попробуйте обновить страницу.
    </p>
    <p
      v-else-if="!Object.keys(groupedMatches).length"
      class="status"
    >
      Матчей нет
    </p>
    <MatchList
      v-else
      :matches="groupedMatches"
      show-date
    />
  </div>
</template>

<style scoped lang="scss">
.home-page {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.page-head__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

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

.page-head__arrows {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.arrow {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid $color-border-strong;
  background: $color-surface;
  color: $color-text;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    border-color: $color-text-3;
    color: $color-accent;
  }

  &:disabled {
    color: $color-text-muted;
    cursor: default;
  }
}

.status {
  padding: 24px 0;
  font-size: 14px;
  color: $color-text-3;
}
</style>
