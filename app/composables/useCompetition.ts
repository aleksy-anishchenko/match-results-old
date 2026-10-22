import type { Competition } from '~/types'

export function useCompetition() {
  const cookie = useCookie<string>('competition', {
    default: () => DEFAULT_COMPETITION_ID,
    maxAge: 60 * 60 * 24 * 365,
  })

  // Выбор один на всё приложение (useState): поле «Лига» и страница видят смену лиги сразу.
  // Отдельные useCookie в разных компонентах узнают друг о друге только через события браузера, с задержкой.
  // В cookie может остаться турнир, которого больше нет в списке (например, убранный ЧМ):
  // иначе страница покажет турнир по умолчанию, а выбор в поле будет пустым.
  // Выбор, сохранённый до перехода на API-Football, — под номером TheSportsDB: переводим в новый
  const saved = THE_SPORTS_DB_COMPETITION_IDS[cookie.value] ?? cookie.value
  const state = useState('competition', () => getCompetition(saved) ? saved : DEFAULT_COMPETITION_ID)
  if (cookie.value !== state.value) cookie.value = state.value

  // cookie только запоминает выбор до следующего визита
  const selectedId = computed({
    get: () => state.value,
    set: (id: string) => {
      state.value = id
      cookie.value = id
    },
  })

  const competition = computed<Competition>(() =>
    getCompetition(selectedId.value) ?? COMPETITIONS[0]!,
  )

  return { selectedId, competition }
}
