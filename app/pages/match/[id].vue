<script setup lang="ts">
import type { MatchDetails, RoundsResponse } from '~/types'

const route = useRoute()
const router = useRouter()
const { selectedId, competition } = useCompetition()

// Ссылка «назад» ведёт туда, откуда пришли: тур или дни главной хранятся в её адресе (/?round=5).
// Историю читаем после монтирования: пока страница собирается, переход в неё ещё не записан
const fromHome = ref(false)
const backTo = ref('/')
onMounted(() => {
  const previousPath = router.options.history.state.back
  if (typeof previousPath === 'string' && (previousPath === '/' || previousPath.startsWith('/?'))) {
    fromHome.value = true
    backTo.value = previousPath
  }
})

// Туры нужны только для подписи ссылки («← 5 тур»): запрашиваем их параллельно с матчем
const roundsRequest = useFetch<RoundsResponse>('/api/rounds', {
  query: computed(() => ({ leagueId: competition.value.id })),
})
const { data: match, pending, error } = await useFetch<MatchDetails>(`/api/match/${route.params.id}`)
const { data: roundsData } = await roundsRequest

// Матч открыли по ссылке, а не с главной: выбранная раньше лига может быть другой (матч РПЛ, а в cookie АПЛ).
// Тогда ссылка ведёт на лигу самого матча и выбирает её на главной
const matchCompetition = computed(() => match.value ? getCompetition(match.value.leagueId) : undefined)

const backLabel = computed(() => fromHome.value
  ? describeHomeSelection(parseHomeQuery(router.resolve(backTo.value).query), roundsData.value, getMoscowDate(new Date()))
  : matchCompetition.value?.name ?? 'Матчи')

function selectMatchCompetition() {
  if (!fromHome.value && matchCompetition.value) selectedId.value = matchCompetition.value.id
}

useHead({
  title: computed(() => match.value
    ? `${getTeamName(match.value.homeTeam)} – ${getTeamName(match.value.awayTeam)}`
    : 'Матч'),
})
</script>

<template>
  <div class="match-page">
    <NuxtLink
      :to="backTo"
      class="back"
      @click="selectMatchCompetition"
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
      {{ backLabel }}
    </NuxtLink>

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
      {{ error.statusCode === 404 ? 'Матч не найден' : 'Не удалось загрузить матч. Попробуйте обновить страницу.' }}
    </p>

    <template v-else-if="match">
      <MatchHeader :match="match" />
      <MatchTimeline
        v-if="match.events.length"
        :events="match.events"
      />
      <MatchStats
        v-if="match.stats.length"
        :stats="match.stats"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.match-page {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.back {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  height: 40px;
  font-size: 15px;
  font-weight: 600;
  color: $color-text-2;
  transition: color 0.15s;

  &:hover {
    color: $color-accent;
  }
}

.status {
  padding: 24px 0;
  font-size: 14px;
  color: $color-text-3;
}
</style>
