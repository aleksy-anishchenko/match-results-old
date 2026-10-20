import type { LocationQuery } from 'vue-router'
import type { DateRange, RoundsResponse } from '~/types'
import { describeDates } from './matches'

/**
 * Что выбрано на главной. Хранится в её адресе: ?round=5 — тур, ?from=…&to=… — дни,
 * без параметров — текущий тур. Так «назад» со страницы матча возвращает туда же, откуда ушли
 */
export type HomeSelection = {
  round: string | null
  range: DateRange | null
}

const queryValue = (value: unknown) => typeof value === 'string' && value ? value : null

export function parseHomeQuery(query: LocationQuery): HomeSelection {
  const from = queryValue(query.from)
  return {
    round: queryValue(query.round),
    range: from ? { from, to: queryValue(query.to) ?? from } : null,
  }
}

/**
 * Подпись ссылки на главную: тур («5 тур») или дни («Сегодня», «12–15 окт»).
 * Без параметров или с неверным туром главная открывает текущий тур, а если туров нет — просто «Матчи»
 */
export function describeHomeSelection(
  selection: HomeSelection,
  roundsData: RoundsResponse | null | undefined,
  today: string,
): string {
  if (selection.range) return describeDates(selection.range, today).label
  const rounds = roundsData?.rounds ?? []
  const round = rounds.find(item => item.id === selection.round) ?? rounds.find(item => item.id === roundsData?.current)
  return round?.name ?? 'Матчи'
}
