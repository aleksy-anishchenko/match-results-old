import type { LiveScore, LiveScoresResponse, Match } from '~/types'

type LiveMatch = Pick<Match, 'idEvent' | 'status' | 'timestamp' | 'homeScore' | 'awayScore' | 'homePenScore' | 'awayPenScore' | 'progress'>

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
  // Номера матчей, о которых спрашиваем. Зависят от времени, поэтому пересчитываем их перед каждым запросом
  const dueIds = ref('')
  const updateDueIds = () => {
    dueIds.value = getDueMatchIds(toValue(matches), Date.now()).join(',')
    return dueIds.value !== ''
  }

  // Сам запрос по смене номеров не повторяется (watch: false) — только когда идущие матчи есть
  const request = useFetch<LiveScoresResponse>('/api/live', {
    query: { ids: dueIds },
    immediate: updateDueIds(),
    watch: false,
  })
  const { data, refresh } = request

  // Другие матчи (тур, дни, лига) — спросить сразу, если среди них есть идущие. По id, а не по самим матчам:
  // страница матча раз в минуту подменяет матч новым объектом, и запрос иначе ушёл бы второй раз
  watch(() => toValue(matches).map(match => match.idEvent).join(), () => {
    if (updateDueIds()) refresh()
  })

  // Расписание на открытой странице может так и помнить «2-й тайм», а матч уже закончился:
  // последнее, что пришло по матчу, не забываем
  const remembered = ref<Record<string, LiveScore>>({})
  watch(data, (value) => {
    remembered.value = { ...remembered.value, ...value?.scores }
  }, { immediate: true })
  const scores = computed(() => ({ ...remembered.value, ...data.value?.scores }))

  const liveMatches = computed(() => toValue(matches).map(match => applyLiveScore(match, scores.value[match.idEvent])))

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      if (document.hidden || !updateDueIds()) return
      refresh()
      onUpdate?.()
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  // await — последним: хуки выше Vue связывает со страницей, только пока не было ни одного await
  await request
  return liveMatches
}
