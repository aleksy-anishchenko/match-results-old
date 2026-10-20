import type { LiveScore, Match, MatchStatusKind } from '~/types'

// Коды strStatus из TheSportsDB. Серия пенальти — PEN (идёт) и AP (завершён по пенальти).
export const FINISHED_MATCH_STATUSES = new Set(['FT', 'AET', 'AP'])
export const LIVE_MATCH_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'PEN', 'LIVE', 'INT'])
/** Матч не состоится или остановлен: перенесён, отменён, прерван, техническое решение */
export const INACTIVE_MATCH_STATUSES = new Set(['PST', 'CANC', 'ABD', 'SUSP', 'AWD', 'WO'])
/** Статусы, при которых у матча есть серия пенальти: идёт (P, PEN) или завершён по пенальти (AP) */
export const PENALTY_MATCH_STATUSES = new Set(['P', 'PEN', 'AP'])

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

export function getRoundCounts(matches: Array<{ intRound: string }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const match of matches) {
    counts.set(match.intRound, (counts.get(match.intRound) ?? 0) + 1)
  }
  return counts
}

export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0
}

/**
 * Для турниров с «общим этапом» (ЛЧ/ЛЕ): раунды общего этапа — это те, что
 * повторяются с одинаковым числом матчей чаще остальных (≥ 3 раундов).
 * Квалификация идёт с переменным числом матчей (двухматчевые пары), а раунды
 * плей-офф — степени двойки, поэтому отсеиваются.
 */
export function getLeaguePhaseRoundCount(counts: Map<string, number>): number | null {
  const frequency = new Map<number, number>()
  for (const count of counts.values()) {
    if (isPowerOfTwo(count)) continue
    frequency.set(count, (frequency.get(count) ?? 0) + 1)
  }
  let best: number | null = null
  let bestFrequency = 0
  for (const [count, freq] of frequency) {
    if (freq > bestFrequency) {
      bestFrequency = freq
      best = count
    }
  }
  return bestFrequency >= 3 ? best : null
}

type RoundMatch = { intRound: string, strHomeTeam: string, strAwayTeam: string }

/**
 * Матчи общего этапа ЛЧ/ЛЕ из расписания сезона. Брать просто раунды с нужным числом матчей нельзя:
 * в 2026/27 TheSportsDB сложил летнюю квалификацию в те же раунды 1–3, что и первые туры, и сыгранные
 * туры терялись (в таблице у всех было 0 игр). Поэтому отбираем по командам: участники общего этапа —
 * команды из «чистых» раундов, а в матче квалификации их двое быть не может (проигравший в турнир
 * не попадает). Раунды плей-офф (16, 32, 125…) отсекаются по номеру: они больше последнего тура.
 */
export function getLeaguePhaseMatches<T extends RoundMatch>(schedule: T[]): T[] {
  const counts = getRoundCounts(schedule)
  const roundSize = getLeaguePhaseRoundCount(counts)
  if (roundSize == null) return []

  const pureRounds = new Set([...counts].filter(([, count]) => count === roundSize).map(([round]) => round))
  const teams = new Set(schedule
    .filter(match => pureRounds.has(match.intRound))
    .flatMap(match => [match.strHomeTeam, match.strAwayTeam]))
  const lastRound = Math.max(...[...pureRounds].map(Number))

  return schedule.filter((match) => {
    const round = Number(match.intRound)
    return round >= 1 && round <= lastRound && teams.has(match.strHomeTeam) && teams.has(match.strAwayTeam)
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
  if (match.status === 'AP') {
    const homePenalties = match.homePenScore ?? 0
    const awayPenalties = match.awayPenScore ?? 0
    if (homePenalties > awayPenalties) return 'home'
    if (awayPenalties > homePenalties) return 'away'
  }
  return null
}
