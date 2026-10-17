import type { Match } from '~/types'
import { getMoscowDate } from '#shared/utils/matches'

export const MATCH_STATUS_LABELS: Record<string, string> = {
  'NS': 'Не начался',
  'TBD': 'Время уточняется',
  '1H': '1-й тайм',
  'HT': 'Перерыв',
  '2H': '2-й тайм',
  'ET': 'Доп. время',
  'BT': 'Перерыв',
  'P': 'Пенальти',
  'PEN': 'Пенальти',
  'LIVE': 'Идёт',
  'INT': 'Остановлен',
  'FT': 'Завершён',
  'AET': 'Завершён (ДВ)',
  'AP': 'Завершён (пен.)',
  'PST': 'Перенесён',
  'CANC': 'Отменён',
  'ABD': 'Прерван',
  'SUSP': 'Приостановлен',
  'AWD': 'Техническое поражение',
  'WO': 'Техническая победа',
}

export function formatMatchStatus(status: string): string {
  return MATCH_STATUS_LABELS[status] ?? status
}

export function formatMoscowTime(timestamp: string): string {
  return new Date(timestamp + 'Z').toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function groupMatchesByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce((acc, match) => {
    const date = getMoscowDate(match.timestamp)
    if (!acc[date]) acc[date] = []
    acc[date]!.push(match)
    return acc
  }, {} as Record<string, Match[]>)
}

/**
 * Дата без года: «Пятница, 18 сентября» (заголовок дня в списке матчей)
 * или с коротким днём недели «Пт, 18 сентября» (страница матча)
 */
export function formatReadableDate(dateStr: string, weekday: 'long' | 'short' = 'long'): string {
  const date = new Date(dateStr + 'T00:00:00')
  const formatted = date.toLocaleDateString('ru-RU', {
    weekday,
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/** Вчера, сегодня или завтра (YYYY-MM-DD): у этих дней на главной свои кнопки */
export function isNearDay(date: string, today: string): boolean {
  return Math.abs(Date.parse(date) - Date.parse(today)) <= 86_400_000
}

/** Даты из календаря на главной: «Вт, 20 октября», «12–15 октября», «28 сентября – 3 октября» */
export function formatDatesTitle(from: string, to: string): string {
  if (from === to) return formatReadableDate(from, 'short')
  const dayMonth = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${Number(from.slice(8))}–${dayMonth(to)}`
    : `${dayMonth(from)} – ${dayMonth(to)}`
}
