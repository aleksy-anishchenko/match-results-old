<script setup lang="ts">
import type { DateRange, MatchesResponse, RoundsResponse } from '~/types'
import type { HomeSelection } from '~/utils/homeQuery'

const { competition } = useCompetition()
const route = useRoute()
const router = useRouter()

const leagueId = computed(() => competition.value.id)
const today = useMoscowToday()

// Что показано, хранится в адресе (см. parseHomeQuery): «назад» со страницы матча возвращает туда же.
// При смене лиги адрес сбрасывается не сразу (router.replace асинхронный): пока он старый,
// выбранный в нём тур или дни относятся к прошлой лиге, и запрос матчей по ним был бы лишним
const queryLeagueId = ref(leagueId.value)
const selection = computed<HomeSelection>(() => queryLeagueId.value === leagueId.value
  ? parseHomeQuery(route.query)
  : { round: null, range: null })

const { data: roundsData } = await useFetch<RoundsResponse>('/api/rounds', {
  query: computed(() => ({ leagueId: leagueId.value })),
})

const rounds = computed(() => roundsData.value?.rounds ?? [])

// Тур из адреса, если он есть в сезоне. Нет параметра или он неверный (?round=99) — текущий тур
const requestedRound = computed(() => rounds.value.find(item => item.id === selection.value.round))

// Без туров (сезона нет в API) показываем сегодняшние матчи: так и выбрано в поле «Дата»
const dateRange = computed<DateRange | null>(() =>
  selection.value.range ?? (rounds.value.length ? null : { from: today.value, to: today.value }))

const round = computed(() => {
  if (dateRange.value) return undefined
  return requestedRound.value ?? rounds.value.find(item => item.id === roundsData.value?.current)
})

// Текущий тур сервер находит сам: в запрос попадает только тур, выбранный явно.
// Так запрос матчей не ждёт туров и не уходит с туром прошлой лиги, пока новые туры грузятся
const { data, pending, error } = await useFetch<MatchesResponse>('/api/matches', {
  query: computed(() => {
    if (dateRange.value) return { leagueId: leagueId.value, dateFrom: dateRange.value.from, dateTo: dateRange.value.to }
    return requestedRound.value ? { leagueId: leagueId.value, round: requestedRound.value.id } : { leagueId: leagueId.value }
  }),
})

const groupedMatches = computed(() =>
  groupMatchesByDate(data.value?.matches ?? []),
)

// По датам туров в поле нет, поэтому тур пишем в заголовке дня: «Воскресенье, 20 сентября · 5 тур».
// Если в день играют матчи разных туров (перенесённый матч), пишем все
const dayNotes = computed(() => {
  if (!dateRange.value) return {}
  const nameById = new Map(rounds.value.map(item => [item.id, item.name]))
  const notes: Record<string, string> = {}
  for (const [date, matches] of Object.entries(groupedMatches.value)) {
    const names = new Set(matches.map(match => match.round && nameById.get(match.round)).filter(Boolean))
    if (names.size) notes[date] = [...names].join(', ')
  }
  return notes
})

// replace, а не push: выбор тура и дат не засоряет историю, «назад» уводит со страницы
function showRound(id?: string) {
  router.replace({ query: id ? { round: id } : {} })
}

function showDates(range: DateRange) {
  router.replace({ query: range })
}

// У другого турнира свои туры: показываем его текущий. Выбор из адреса снова берём, когда адрес сброшен
watch(leagueId, async (id) => {
  await router.replace({ query: {} })
  queryLeagueId.value = id
})
</script>

<template>
  <div class="home-page">
    <!-- Что выбрано, видно по полям ниже; заголовок нужен экранному диктору и поисковикам -->
    <h1 class="visually-hidden">
      Матчи: {{ competition.name }}
    </h1>

    <div class="toolbar">
      <CompetitionBar />
      <div
        class="filters"
        role="group"
        aria-label="Тур или дата"
      >
        <RoundSelect
          v-if="rounds.length"
          class="filters__field"
          :class="{ 'filters__field--selected': round }"
          :rounds="rounds"
          :selected="round?.id ?? null"
          :current="roundsData?.current ?? null"
          :today="today"
          @select="showRound"
        />
        <DateSelect
          class="filters__field"
          :class="{ 'filters__field--selected': dateRange }"
          :range="dateRange"
          :match-days="roundsData?.matchDays ?? []"
          :today="today"
          @select="showDates"
        />
      </div>
    </div>

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
      :day-notes="dayNotes"
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

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;

  @media (min-width: $breakpoint-desktop) {
    gap: 16px;
  }
}

.filters {
  display: flex;
  gap: 8px;
}

// На телефоне выбранное поле растягивается на остаток строки, второе — по своему содержимому
.filters__field {
  flex: 0 0 auto;
}

.filters__field--selected {
  flex: 1 1 auto;

  @media (min-width: $breakpoint-desktop) {
    flex: 0 0 auto;
  }
}

.status {
  padding: 24px 0;
  font-size: 14px;
  color: $color-text-3;
}
</style>
