import type { LiveScore, LiveScoresResponse, Match } from '~/types'

type LiveMatch = Pick<Match, 'id' | 'status' | 'timestamp' | 'homeScore' | 'awayScore' | 'homePenScore' | 'awayPenScore' | 'progress'>

/**
 * Матчи со свежим счётом и минутой из /api/live поверх расписания. Пока по расписанию среди них есть идущие
 * или те, что по времени уже должны идти (getDueMatchIds), раз в минуту спрашиваем о них заново и зовём onUpdate
 * (страница матча заодно обновляет хронику). Нет таких матчей — /api/live не спрашиваем вовсе.
 * Вкладку в фоне не обновляем: догонит на следующей минуте после возврата.
 *
 * Ждать через await, как useFetch: иначе при переходе по сайту страница сначала покажет счёт из расписания,
 * а через мгновение — свежий
 */
export async function useLiveScores<T extends LiveMatch>(
  matches: MaybeRefOrGetter<T[]>,
  onUpdate?: () => unknown,
) {
  // Расписание на открытой странице может так и помнить «2-й тайм», а матч уже закончился:
  // последнее, что пришло по матчу, не забываем
  const remembered = ref<Record<string, LiveScore>>({})

  // Номера матчей, о которых спрашиваем: по расписанию идущие или те, что уже должны идти, — кроме тех,
  // о которых живые данные уже сказали «закончен». Зависят от времени — пересчитываем перед каждым запросом.
  // true — по расписанию есть идущие матчи: страницу матча обновляем, даже если о живом счёте спрашивать нечего
  const dueIds = ref('')
  const updateDueIds = () => {
    const due = getDueMatchIds(toValue(matches), Date.now())
    dueIds.value = due.filter(id => !FINISHED_MATCH_STATUSES.has(remembered.value[id]?.status ?? '')).join(',')
    return due.length > 0
  }

  // Сам запрос по смене номеров не повторяется (watch: false) — только когда есть о чём спросить
  const request = useFetch<LiveScoresResponse>('/api/live', {
    query: { ids: dueIds },
    immediate: updateDueIds() && dueIds.value !== '',
    watch: false,
  })
  const { data, refresh } = request

  watch(data, (value) => {
    remembered.value = { ...remembered.value, ...value?.scores }
  }, { immediate: true })
  const scores = computed(() => ({ ...remembered.value, ...data.value?.scores }))

  // Другие матчи (тур, дни, лига) — спросить сразу, если среди них есть идущие. По id, а не по самим матчам:
  // страница матча раз в минуту подменяет матч новым объектом, и запрос иначе ушёл бы второй раз
  watch(() => toValue(matches).map(match => match.id).join(), () => {
    if (updateDueIds() && dueIds.value) refresh()
  })

  const liveMatches = computed(() => toValue(matches).map(match => applyLiveScore(match, scores.value[match.id])))

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      if (document.hidden || !updateDueIds()) return
      if (dueIds.value) refresh()
      onUpdate?.()
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  // await — последним: хуки выше Vue связывает со страницей, только пока не было ни одного await
  await request
  return liveMatches
}
