import type { Competition } from '~/types'

export function useCompetition() {
  const selectedId = useCookie<string>('competition', {
    default: () => DEFAULT_COMPETITION_ID,
    maxAge: 60 * 60 * 24 * 365,
  })

  // В cookie может остаться турнир, которого больше нет в списке (например, убранный ЧМ):
  // иначе страница покажет турнир по умолчанию, а выбор в шапке будет пустым
  if (!getCompetition(selectedId.value)) {
    selectedId.value = DEFAULT_COMPETITION_ID
  }

  const competition = computed<Competition>(() =>
    getCompetition(selectedId.value) ?? COMPETITIONS[0]!,
  )

  return { selectedId, competition }
}
