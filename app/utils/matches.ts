import type { Match } from '~/types'

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

export function formatMoscowDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const formatted = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function groupMatchesByDate(matches: Match[]): Record<string, Match[]> {
  return matches.reduce((acc, match) => {
    const date = new Date(match.timestamp + 'Z').toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
    if (!acc[date]) acc[date] = []
    acc[date]!.push(match)
    return acc
  }, {} as Record<string, Match[]>)
}

/** Заголовок дня в списке матчей: «Пятница, 18 сентября», без года */
export function formatReadableDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const formatted = date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
