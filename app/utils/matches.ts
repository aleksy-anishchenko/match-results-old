import type { DateRange, Match } from '~/types'
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
  'LIVE': 'Идёт',
  'INT': 'Остановлен',
  'FT': 'Завершён',
  'AET': 'Завершён (ДВ)',
  'PEN': 'Завершён (пен.)',
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

const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const SHORT_WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** Быстрые кнопки дат на главной: сдвиг от сегодняшнего дня по Москве */
export const NEAR_DAYS = [
  { offset: -1, label: 'Вчера' },
  { offset: 0, label: 'Сегодня' },
  { offset: 1, label: 'Завтра' },
] as const

/** День (YYYY-MM-DD) на days дней позже или раньше: shiftDate('2026-10-31', 1) → '2026-11-01' */
export function shiftDate(date: string, days: number): string {
  const result = new Date(date + 'T00:00:00Z')
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

/** «20 сен». Свой список месяцев: toLocaleDateString даёт «сент.» с точкой */
export function formatShortDate(date: string): string {
  return `${Number(date.slice(8, 10))} ${SHORT_MONTHS[Number(date.slice(5, 7)) - 1]}`
}

/** Даты тура или дни из календаря: «20 сен», «18–20 сен», «28 сен – 3 окт» */
export function formatShortDates(from: string, to: string): string {
  if (from === to) return formatShortDate(from)
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${Number(from.slice(8, 10))}–${formatShortDate(to)}`
    : `${formatShortDate(from)} – ${formatShortDate(to)}`
}

/**
 * Подпись выбранных дней: у вчера, сегодня и завтра — слово и дата отдельно («Сегодня» + «20 сен»),
 * у другого дня — день недели («Сб, 12 сен»), у нескольких дней — диапазон («12–15 окт»)
 */
export function describeDates({ from, to }: DateRange, today: string): { label: string, hint: string | null } {
  if (from !== to) return { label: formatShortDates(from, to), hint: null }
  const nearDay = NEAR_DAYS.find(day => shiftDate(today, day.offset) === from)
  if (nearDay) return { label: nearDay.label, hint: formatShortDate(from) }
  const weekday = SHORT_WEEKDAYS[new Date(from + 'T00:00:00Z').getUTCDay()]
  return { label: `${weekday}, ${formatShortDate(from)}`, hint: null }
}
