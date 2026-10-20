import type { LiveScore, LiveScoresResponse, Match } from '~/types'

type LiveMatch = Pick<Match, 'idEvent' | 'status' | 'timestamp' | 'homeScore' | 'awayScore' | 'progress'>

/**
 * Матчи со свежим счётом и минутой из /api/live поверх расписания. Пока среди них есть идущий или тот,
 * что по времени уже должен идти, раз в минуту спрашиваем заново и зовём onUpdate (страница матча
 * заодно обновляет хронику). Вкладку в фоне не обновляем: догонит на следующей минуте после возврата.
 *
 * Ждать через await, как useFetch: иначе при переходе по сайту страница сначала покажет счёт из расписания,
 * а через мгновение — свежий
 */
export async function useLiveScores<T extends LiveMatch>(
  leagueId: MaybeRefOrGetter<string>,
  matches: MaybeRefOrGetter<T[]>,
  onUpdate?: () => unknown,
) {
  // Лига — отдельным computed: страница матча подменяет матч целиком (та же лига, новый объект),
  // и запрос с тем же leagueId иначе ушёл бы ещё раз
  const league = computed(() => toValue(leagueId))
  const request = useFetch<LiveScoresResponse>('/api/live', {
    query: computed(() => ({ leagueId: league.value })),
  })
  const { data, refresh } = request

  // Закончившийся матч через какое-то время пропадает из livescore, а расписание на открытой странице
  // так и помнит «2-й тайм»: последнее, что пришло по матчу, не забываем
  const remembered = ref<Record<string, LiveScore>>({})
  watch(data, (value) => {
    remembered.value = { ...remembered.value, ...value?.scores }
  }, { immediate: true })
  const scores = computed(() => ({ ...remembered.value, ...data.value?.scores }))

  const liveMatches = computed(() => toValue(matches).map(match => applyLiveScore(match, scores.value[match.idEvent])))

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      if (document.hidden || !needsLiveScores(liveMatches.value, Date.now())) return
      refresh()
      onUpdate?.()
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  // await — последним: хуки выше Vue связывает со страницей, только пока не было ни одного await
  await request
  return liveMatches
}
