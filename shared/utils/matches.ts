import type { BracketMatch, MatchStatusKind } from '~/types'

// Коды strStatus из TheSportsDB. Серия пенальти — PEN (идёт) и AP (завершён по пенальти).
export const FINISHED_MATCH_STATUSES = new Set(['FT', 'AET', 'AP'])
export const LIVE_MATCH_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'PEN', 'LIVE', 'INT'])
/** Матч не состоится или остановлен: перенесён, отменён, прерван, техническое решение */
export const INACTIVE_MATCH_STATUSES = new Set(['PST', 'CANC', 'ABD', 'SUSP', 'AWD', 'WO'])

export function getMatchStatusKind(status: string): MatchStatusKind {
  if (LIVE_MATCH_STATUSES.has(status)) return 'live'
  if (FINISHED_MATCH_STATUSES.has(status)) return 'finished'
  if (INACTIVE_MATCH_STATUSES.has(status)) return 'inactive'
  return 'scheduled'
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

export function getMatchWinnerSide(match: BracketMatch): 'home' | 'away' | null {
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
