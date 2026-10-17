import type { BracketMatch, BracketRound, Competition } from '~/types'
import { getMatchWinnerSide, getRoundCounts, isPowerOfTwo } from './matches'

/** Матч из расписания TheSportsDB: поля, нужные для сетки плей-офф */
export type BracketScheduleMatch = {
  idEvent: string
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  strTimestamp: string
  intRound: string
}

/** Счёт серии пенальти по idEvent (его отдаёт только lookupevent) */
export type BracketPenaltyScores = Record<string, { home: number | null, away: number | null }>

/**
 * Матчи плей-офф из расписания сезона. У турниров с общим этапом (ЛЧ/ЛЕ) в расписании лежат
 * ещё и матчи квалификации — оставляем только раунды плей-офф (степени двойки: 16/8/4/2/1).
 * У турниров с группами плей-офф — всё, что не групповой этап.
 */
export function getPlayoffMatches<T extends BracketScheduleMatch>(
  schedule: T[],
  competition: Pick<Competition, 'groupRounds' | 'leaguePhase'>,
): T[] {
  if (competition.leaguePhase) {
    const knockoutRounds = new Set(
      [...getRoundCounts(schedule).entries()]
        .filter(([, count]) => isPowerOfTwo(count))
        .map(([round]) => round),
    )
    return schedule.filter(match => knockoutRounds.has(match.intRound))
  }

  const groupRounds = new Set(competition.groupRounds ?? [])
  return schedule.filter(match => !groupRounds.has(match.intRound))
}

// For rounds after the first one: sort matches by bracket position derived from prev round.
// Also detects when home/away are reversed vs bracket seeding and flags for swap.
// Even-indexed prev match winner → home (top); odd-indexed → away (bottom).
function sortByBracketPosition(
  matches: BracketScheduleMatch[],
  prevMatches: BracketMatch[],
): Array<{ match: BracketScheduleMatch, swapped: boolean }> {
  const slotCount = Math.floor(prevMatches.length / 2)
  const result: ({ match: BracketScheduleMatch, swapped: boolean } | null)[] = new Array(slotCount).fill(null)
  const placedIds = new Set<string>()

  for (const match of matches) {
    for (let i = 0; i < prevMatches.length; i++) {
      const prev = prevMatches[i]!
      const prevTeams = [prev.homeTeam, prev.awayTeam]
      const homeInPrev = prevTeams.includes(match.strHomeTeam)
      const awayInPrev = prevTeams.includes(match.strAwayTeam)
      if (!homeInPrev && !awayInPrev) continue

      const slot = Math.floor(i / 2)
      if (!result[slot]) {
        // Even prev index → winner should be home (top in bracket)
        const isEven = i % 2 === 0
        const swapped = homeInPrev ? !isEven : isEven
        result[slot] = { match, swapped }
        placedIds.add(match.idEvent)
      }
      break
    }
  }

  const remaining = matches.filter(match => !placedIds.has(match.idEvent))
  let remainingIndex = 0
  return result.map(slot => slot ?? { match: remaining[remainingIndex++] ?? matches[0]!, swapped: false })
}

function getRoundName(count: number, isLast: boolean, isSecondToLast: boolean): string {
  if (count === 1 && isLast) return 'Финал'
  if (count === 1 && isSecondToLast) return 'Матч за 3-е место'
  if (count === 2) return 'Полуфинал'
  if (count === 4) return 'Четвертьфинал'
  if (count === 8) return '1/8 финала'
  if (count === 16) return '1/16 финала'
  return 'Раунд'
}

function matchWinner(match: BracketMatch): { team: string, badge: string } | null {
  const winnerSide = getMatchWinnerSide(match)
  if (winnerSide === 'home') return { team: match.homeTeam, badge: match.homeBadge }
  if (winnerSide === 'away') return { team: match.awayTeam, badge: match.awayBadge }
  return null
}

function buildProjectedRounds(seed: BracketRound): BracketRound[] {
  const result: BracketRound[] = []
  let prev = seed.matches

  while (prev.length > 1) {
    const next: BracketMatch[] = []
    for (let i = 0; i < prev.length; i += 2) {
      const topMatch = prev[i]!
      const bottomMatch = prev[i + 1]
      const topWinner = matchWinner(topMatch)
      const bottomWinner = bottomMatch ? matchWinner(bottomMatch) : null
      next.push({
        idEvent: `proj-${result.length}-${i}`,
        homeTeam: topWinner?.team ?? '',
        awayTeam: bottomWinner?.team ?? '',
        homeBadge: topWinner?.badge ?? '',
        awayBadge: bottomWinner?.badge ?? '',
        homeScore: null,
        awayScore: null,
        homePenScore: null,
        awayPenScore: null,
        status: 'NS',
        timestamp: '',
      })
    }
    result.push({ round: `proj-${result.length + 1}`, name: '', matches: next, projected: true })
    prev = next
    if (next.length === 1) break
  }

  const total = result.length
  result.forEach((r, idx) => {
    r.name = getRoundName(r.matches.length, idx === total - 1, idx === total - 2)
  })

  return result
}

/** Сетка плей-офф: раунды по порядку, а после последнего сыгранного — будущие раунды из победителей */
export function buildBracket(
  playoffMatches: BracketScheduleMatch[],
  penScoreMap: BracketPenaltyScores,
): BracketRound[] {
  if (!playoffMatches.length) return []

  const byRound: Record<string, BracketScheduleMatch[]> = {}
  for (const match of playoffMatches) {
    if (!byRound[match.intRound]) byRound[match.intRound] = []
    byRound[match.intRound]!.push(match)
  }

  // A real knockout ladder halves in size each round (16 matches, then 8, then 4...).
  // The provider occasionally adds an extra fixture under an unrelated round id
  // (e.g. a third-place playoff) that breaks that sequence — walking the chain from
  // the biggest round and stopping at the first gap keeps only rounds that actually
  // belong to the ladder, so a stray fixture can't corrupt the bracket layout.
  const matchCountsByRound = Object.fromEntries(
    Object.entries(byRound).map(([round, matches]) => [round, matches.length]),
  )
  const maxMatchCount = Math.max(...Object.values(matchCountsByRound))
  const ladderMatchCounts = new Set<number>()
  for (let count = maxMatchCount; Object.values(matchCountsByRound).includes(count); count /= 2) {
    ladderMatchCounts.add(count)
  }

  // Матч за 3-е место (раунд 160, например в финале Лиги наций) тоже из одного матча, как финал,
  // и цепочка его не отсекает. В сетку идёт только финал: его играют последним (бывает, в тот же день).
  const finalRound = Object.keys(byRound)
    .filter(round => matchCountsByRound[round] === 1)
    .sort((a, b) => byRound[a]![0]!.strTimestamp.localeCompare(byRound[b]![0]!.strTimestamp))
    .at(-1)

  const sortedKeys = Object.keys(byRound)
    .filter(round => ladderMatchCounts.has(matchCountsByRound[round]!))
    .filter(round => matchCountsByRound[round] !== 1 || round === finalRound)
    .sort((a, b) => matchCountsByRound[b]! - matchCountsByRound[a]!)
  const total = sortedKeys.length

  const rounds: BracketRound[] = []

  for (let index = 0; index < sortedKeys.length; index++) {
    const round = sortedKeys[index]!
    const sorted = byRound[round]!.sort((a, b) => a.strTimestamp.localeCompare(b.strTimestamp))

    type Ordered = { match: BracketScheduleMatch, swapped: boolean }
    let ordered: Ordered[]

    if (rounds.length > 0) {
      // All subsequent rounds: derive position and home/away order from previous round
      ordered = sortByBracketPosition(sorted, rounds[rounds.length - 1]!.matches)
    }
    else {
      ordered = sorted.map(match => ({ match, swapped: false }))
    }

    const bracketMatches: BracketMatch[] = ordered.map(({ match, swapped }) => {
      const pen = penScoreMap[match.idEvent]
      return {
        idEvent: match.idEvent,
        homeTeam: swapped ? match.strAwayTeam : match.strHomeTeam,
        awayTeam: swapped ? match.strHomeTeam : match.strAwayTeam,
        homeBadge: swapped ? match.strAwayTeamBadge : match.strHomeTeamBadge,
        awayBadge: swapped ? match.strHomeTeamBadge : match.strAwayTeamBadge,
        homeScore: swapped ? match.intAwayScore : match.intHomeScore,
        awayScore: swapped ? match.intHomeScore : match.intAwayScore,
        homePenScore: swapped ? (pen?.away ?? null) : (pen?.home ?? null),
        awayPenScore: swapped ? (pen?.home ?? null) : (pen?.away ?? null),
        status: match.strStatus,
        timestamp: match.strTimestamp,
      }
    })

    rounds.push({
      round,
      name: getRoundName(bracketMatches.length, index === total - 1, index === total - 2),
      projected: false,
      matches: bracketMatches,
    })
  }

  // Build projected rounds from the last actual round if it has multiple matches
  const lastRound = rounds[rounds.length - 1]
  if (lastRound && lastRound.matches.length > 1) {
    rounds.push(...buildProjectedRounds(lastRound))
  }

  return rounds
}
