import { getMoscowDate } from '#shared/utils/matches'

/**
 * Сегодня по Москве (YYYY-MM-DD). Раз в минуту проверяем, не наступил ли новый день:
 * вкладка, оставленная открытой за полночь, иначе так и считала бы «сегодня» вчерашним днём
 */
export function useMoscowToday() {
  const today = ref(getMoscowDate(new Date()))
  let timer: ReturnType<typeof setInterval> | undefined

  // Таймер только в браузере: на сервере страница собирается один раз
  onMounted(() => {
    timer = setInterval(() => {
      today.value = getMoscowDate(new Date())
    }, 60_000)
  })
  onBeforeUnmount(() => clearInterval(timer))

  return today
}
