import type { LiveScore, Match, MatchStatusKind } from '~/types'

// Коды статусов API-Football. Серия пенальти — P (идёт) и PEN (матч завершён по пенальти);
// у TheSportsDB было наоборот: PEN — идёт, AP — завершён
export const FINISHED_MATCH_STATUSES = new Set(['FT', 'AET', 'PEN'])
export const LIVE_MATCH_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'])
/** Матч не состоится или остановлен: перенесён, отменён, прерван, техническое решение */
export const INACTIVE_MATCH_STATUSES = new Set(['PST', 'CANC', 'ABD', 'SUSP', 'AWD', 'WO'])
/** Статусы, при которых у матча есть серия пенальти: идёт (P) или завершён по пенальти (PEN) */
export const PENALTY_MATCH_STATUSES = new Set(['P', 'PEN'])

/**
 * Дата по Москве в виде YYYY-MM-DD. Строка — это timestamp из API: время UTC без смещения
 * («2026-06-23T22:30:00»). Date — любой момент, например «сейчас».
 */
export function getMoscowDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value + 'Z') : value
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })
}

export function getMatchStatusKind(status: string): MatchStatusKind {
  if (LIVE_MATCH_STATUSES.has(status)) return 'live'
  if (FINISHED_MATCH_STATUSES.has(status)) return 'finished'
  if (INACTIVE_MATCH_STATUSES.has(status)) return 'inactive'
  return 'scheduled'
}

/**
 * Ссылка на видеообзор из API, если это https-ссылка на YouTube; иначе null.
 * Адрес попадает в href, поэтому чужие схемы (javascript:) и сайты не пропускаем
 */
export function getVideoUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const youtube = /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === 'youtu.be'
    return url.protocol === 'https:' && youtube ? url.href : null
  }
  catch {
    return null
  }
}

/** Время матча идёт — показываем минуту. В перерыве и серии пенальти — подпись статуса («Перерыв») */
const RUNNING_MATCH_STATUSES = new Set(['1H', '2H', 'ET'])

type LiveFields = Pick<Match, 'status' | 'homeScore' | 'awayScore' | 'progress'>

/**
 * Матч со счётом, статусом и минутой из livescore. Если по расписанию матч уже закончен или не состоится,
 * верим расписанию: закончившийся матч остаётся в livescore ещё какое-то время и там может отстать
 */
export function applyLiveScore<T extends LiveFields>(match: T, live: LiveScore | undefined): T {
  if (!live || FINISHED_MATCH_STATUSES.has(match.status) || INACTIVE_MATCH_STATUSES.has(match.status)) return match
  return {
    ...match,
    status: live.status,
    homeScore: live.homeScore,
    awayScore: live.awayScore,
    progress: RUNNING_MATCH_STATUSES.has(live.status) ? live.progress : null,
  }
}

/** Сколько ждём начала матча после времени из расписания: за 3 часа закончится и матч с доп. временем */
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * Пора ли спросить livescore: по расписанию среди матчей есть идущий или тот, что по времени уже должен идти,
 * а расписание ещё пишет «не начался», — не дольше 3 часов от начала. Решаем по расписанию, а не по livescore:
 * по livescore матч заканчивается раньше, чем страница успевает получить его итоговые хронику и составы.
 * now — миллисекунды, как Date.now()
 */
export function needsLiveScores(matches: Array<Pick<Match, 'status' | 'timestamp'>>, now: number): boolean {
  return matches.some((match) => {
    const kind = getMatchStatusKind(match.status)
    if (kind !== 'live' && kind !== 'scheduled') return false
    const startsAt = Date.parse(`${match.timestamp}Z`)
    // Без времени начала окна не посчитать: идущий матч всё равно обновляем
    if (Number.isNaN(startsAt)) return kind === 'live'
    return startsAt <= now && now - startsAt < LIVE_WINDOW_MS
  })
}

export function getMatchWinnerSide(
  match: Pick<Match, 'homeScore' | 'awayScore' | 'homePenScore' | 'awayPenScore' | 'status'>,
): 'home' | 'away' | null {
  if (!FINISHED_MATCH_STATUSES.has(match.status)) return null
  const homeScore = Number(match.homeScore ?? 0)
  const awayScore = Number(match.awayScore ?? 0)
  if (homeScore > awayScore) return 'home'
  if (awayScore > homeScore) return 'away'
  if (match.status === 'PEN') {
    const homePenalties = match.homePenScore ?? 0
    const awayPenalties = match.awayPenScore ?? 0
    if (homePenalties > awayPenalties) return 'home'
    if (awayPenalties > homePenalties) return 'away'
  }
  return null
}
