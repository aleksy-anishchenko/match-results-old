import type { LiveScore, Match, MatchEvent, MatchStatusKind } from '~/types'

// Коды статусов API-Football. Серия пенальти — P (идёт) и PEN (матч завершён по пенальти);
// у TheSportsDB было наоборот: PEN — идёт, AP — завершён
export const FINISHED_MATCH_STATUSES = new Set(['FT', 'AET', 'PEN'])
export const LIVE_MATCH_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'])
/** Матч не состоится или остановлен: перенесён, отменён, прерван, техническое решение */
export const INACTIVE_MATCH_STATUSES = new Set(['PST', 'CANC', 'ABD', 'SUSP', 'AWD', 'WO'])
/** Статусы, при которых у матча есть серия пенальти: идёт (P) или завершён по пенальти (PEN) */
const PENALTY_MATCH_STATUSES = new Set(['P', 'PEN'])

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

/** Время матча идёт — показываем минуту. В перерыве и серии пенальти — подпись статуса («Перерыв») */
const RUNNING_MATCH_STATUSES = new Set(['1H', '2H', 'ET'])

/** Минута идущего матча из API-Football: «52», с добавленным временем — «45+2». null — время не идёт */
export function formatMatchProgress(status: string, elapsed: number | null, extra: number | null): string | null {
  if (!RUNNING_MATCH_STATUSES.has(status) || elapsed == null) return null
  return extra ? `${elapsed}+${extra}` : String(elapsed)
}

type LiveFields = Pick<Match, 'status' | 'homeScore' | 'awayScore' | 'homePenScore' | 'awayPenScore' | 'progress'>

/**
 * Матч со счётом, статусом и минутой из живых данных. Если по расписанию матч уже закончен или не состоится,
 * верим расписанию: живые данные о нём и так те же, а расписание с ними уже сошлось
 */
export function applyLiveScore<T extends LiveFields>(match: T, live: LiveScore | undefined): T {
  if (!live || FINISHED_MATCH_STATUSES.has(match.status) || INACTIVE_MATCH_STATUSES.has(match.status)) return match
  return {
    ...match,
    status: live.status,
    homeScore: live.homeScore,
    awayScore: live.awayScore,
    homePenScore: live.homePenScore,
    awayPenScore: live.awayPenScore,
    progress: RUNNING_MATCH_STATUSES.has(live.status) ? live.progress : null,
  }
}

/**
 * Счёт серии пенальти: «4:3». null — серии нет. Только у статусов P и PEN:
 * нули в этих полях у обычного матча — не серия
 */
export function formatPenaltyScore(match: Pick<Match, 'status' | 'homePenScore' | 'awayPenScore'>): string | null {
  const { status, homePenScore, awayPenScore } = match
  if (!PENALTY_MATCH_STATUSES.has(status) || homePenScore == null || awayPenScore == null) return null
  return `${homePenScore}:${awayPenScore}`
}

/** Сколько ждём начала матча после времени из расписания: за 3 часа закончится и матч с доп. временем */
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * Матчи, о которых пора спросить живые данные: по расписанию идущие и те, что по времени уже должны идти,
 * а расписание ещё пишет «не начался», — не дольше 3 часов от начала. Решаем по расписанию, а не по живым
 * данным: по ним матч заканчивается раньше, чем страница успевает получить его итоговые хронику и составы.
 * now — миллисекунды, как Date.now()
 */
export function getDueMatchIds(matches: Array<Pick<Match, 'id' | 'status' | 'timestamp'>>, now: number): string[] {
  return matches.filter((match) => {
    const kind = getMatchStatusKind(match.status)
    if (kind !== 'live' && kind !== 'scheduled') return false
    const startsAt = Date.parse(`${match.timestamp}Z`)
    // Без времени начала окна не посчитать: идущий матч всё равно обновляем
    if (Number.isNaN(startsAt)) return kind === 'live'
    return startsAt <= now && now - startsAt < LIVE_WINDOW_MS
  }).map(match => match.id)
}

export function getMatchWinnerSide(
  match: Pick<Match, 'homeScore' | 'awayScore' | 'homePenScore' | 'awayPenScore' | 'status'>,
): 'home' | 'away' | null {
  if (!FINISHED_MATCH_STATUSES.has(match.status)) return null
  const homeScore = match.homeScore ?? 0
  const awayScore = match.awayScore ?? 0
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

const GOAL_EVENT_KINDS = new Set<MatchEvent['kind']>(['goal', 'penalty', 'own-goal'])

/** Гол: обычный, с пенальти или автогол */
export const isGoalEvent = (event: Pick<MatchEvent, 'kind'>) => GOAL_EVENT_KINDS.has(event.kind)

/**
 * Голы хроники сходятся со счётом. Хроника бывает неполной, а во время матча может отставать
 * от счёта — тогда её не показываем: неполный список голов выглядит как ошибка.
 */
export function goalsMatchScore(events: MatchEvent[], homeScore: number | null, awayScore: number | null): boolean {
  const count = (side: MatchEvent['side']) => events.filter(event => event.side === side && isGoalEvent(event)).length
  return count('home') === (homeScore ?? 0) && count('away') === (awayScore ?? 0)
}
