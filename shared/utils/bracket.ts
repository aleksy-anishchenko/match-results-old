import type { BracketRound, BracketTeam, BracketTie, Competition } from '~/types'
import { FINISHED_MATCH_STATUSES, getRoundCounts, isPowerOfTwo } from './matches'

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

/** Сумма голов команды за сыгранные матчи пары; null — ни один матч ещё не завершён */
export function getTieTotal(team: BracketTeam): number | null {
  const played = team.goals.filter(goals => goals != null)
  return played.length ? played.reduce((sum, goals) => sum + goals, 0) : null
}

const byTimestamp = (a: BracketScheduleMatch, b: BracketScheduleMatch) => a.strTimestamp.localeCompare(b.strTimestamp)

const playsIn = (match: BracketScheduleMatch, team: string) => match.strHomeTeam === team || match.strAwayTeam === team

function teamOfTie(legs: BracketScheduleMatch[], name: string, badge: string, penScoreMap: BracketPenaltyScores): BracketTeam {
  const goals = legs.map((leg) => {
    if (!FINISHED_MATCH_STATUSES.has(leg.strStatus)) return null
    const score = leg.strHomeTeam === name ? leg.intHomeScore : leg.intAwayScore
    return score == null ? null : Number(score)
  })
  // Серия пенальти бывает только в последнем матче пары
  const lastLeg = legs.at(-1)!
  const penalties = penScoreMap[lastLeg.idEvent]
  return {
    name,
    badge,
    goals,
    penalties: (lastLeg.strHomeTeam === name ? penalties?.home : penalties?.away) ?? null,
  }
}

/**
 * Кто прошёл дальше. Сначала смотрим, кто из двоих играл после пары: это надёжнее счёта,
 * потому что в ЛЧ 2024/25 у пар, решённых серией пенальти, статус FT и счёта серии нет.
 * Если после пары играли обе команды (полуфинал, потом финал и матч за 3-е место),
 * решает счёт: сумма, потом пенальти. Пока не все матчи пары завершены, победителя нет.
 */
function tieWinner(
  teams: [BracketTeam, BracketTeam],
  legs: BracketScheduleMatch[],
  playoffMatches: BracketScheduleMatch[],
): 0 | 1 | null {
  const [first, second] = teams
  const lastTimestamp = legs.at(-1)!.strTimestamp
  const playedLater = (team: BracketTeam) => team.name !== ''
    && playoffMatches.some(match => match.strTimestamp > lastTimestamp && playsIn(match, team.name))
  if (playedLater(first) !== playedLater(second)) return playedLater(first) ? 0 : 1

  if (teams.some(team => team.goals.includes(null))) return null
  const firstTotal = getTieTotal(first) ?? 0
  const secondTotal = getTieTotal(second) ?? 0
  if (firstTotal !== secondTotal) return firstTotal > secondTotal ? 0 : 1

  if (first.penalties == null || second.penalties == null || first.penalties === second.penalties) return null
  return first.penalties > second.penalties ? 0 : 1
}

/**
 * Пары раунда: матчи одних и тех же двух команд — одна пара, один матч или два. Порядок пар —
 * по первому матчу, команды — как в первом матче (хозяин сверху). Матчи, где соперник ещё
 * не определён, не склеиваем: таких в раунде может быть несколько.
 */
export function buildTies(
  roundMatches: BracketScheduleMatch[],
  playoffMatches: BracketScheduleMatch[],
  penScoreMap: BracketPenaltyScores,
): BracketTie[] {
  const legsByTie = new Map<string, BracketScheduleMatch[]>()
  for (const match of [...roundMatches].sort(byTimestamp)) {
    const key = match.strHomeTeam && match.strAwayTeam
      ? [match.strHomeTeam, match.strAwayTeam].sort().join('\n')
      : match.idEvent
    legsByTie.set(key, [...(legsByTie.get(key) ?? []), match])
  }

  return [...legsByTie.values()].map((legs) => {
    const first = legs[0]!
    const teams: [BracketTeam, BracketTeam] = [
      teamOfTie(legs, first.strHomeTeam, first.strHomeTeamBadge, penScoreMap),
      teamOfTie(legs, first.strAwayTeam, first.strAwayTeamBadge, penScoreMap),
    ]
    return { id: first.idEvent, teams, winner: tieWinner(teams, legs, playoffMatches) }
  })
}

function swapTeams(tie: BracketTie): BracketTie {
  return {
    ...tie,
    teams: [tie.teams[1], tie.teams[0]],
    winner: tie.winner == null ? null : tie.winner === 0 ? 1 : 0,
  }
}

// For rounds after the first one: sort ties by bracket position derived from prev round.
// Also detects when the teams are reversed vs bracket seeding and swaps them.
// Even-indexed prev tie winner → top; odd-indexed → bottom.
function sortByBracketPosition(ties: BracketTie[], prevTies: BracketTie[]): BracketTie[] {
  const slotCount = Math.floor(prevTies.length / 2)
  const result: (BracketTie | null)[] = new Array(slotCount).fill(null)
  const placedIds = new Set<string>()

  for (const tie of ties) {
    for (let i = 0; i < prevTies.length; i++) {
      const prevTeams = prevTies[i]!.teams.map(team => team.name)
      const topInPrev = prevTeams.includes(tie.teams[0].name)
      const bottomInPrev = prevTeams.includes(tie.teams[1].name)
      if (!topInPrev && !bottomInPrev) continue

      const slot = Math.floor(i / 2)
      if (!result[slot]) {
        // Even prev index → winner should be on top
        const isEven = i % 2 === 0
        const swapped = topInPrev ? !isEven : isEven
        result[slot] = swapped ? swapTeams(tie) : tie
        placedIds.add(tie.id)
      }
      break
    }
  }

  const remaining = ties.filter(tie => !placedIds.has(tie.id))
  let remainingIndex = 0
  return result.map(slot => slot ?? remaining[remainingIndex++] ?? ties[0]!)
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

/** Команда будущей пары: победитель пары прошлого раунда или пустое место, пока он не известен */
function winnerOf(tie: BracketTie | undefined): BracketTeam {
  const winner = tie?.winner == null ? null : tie.teams[tie.winner]
  return { name: winner?.name ?? '', badge: winner?.badge ?? '', goals: [], penalties: null }
}

function buildProjectedRounds(seed: BracketRound): BracketRound[] {
  const result: BracketRound[] = []
  let prev = seed.ties

  while (prev.length > 1) {
    const next: BracketTie[] = []
    for (let i = 0; i < prev.length; i += 2) {
      next.push({
        id: `proj-${result.length}-${i}`,
        teams: [winnerOf(prev[i]), winnerOf(prev[i + 1])],
        winner: null,
      })
    }
    result.push({ round: `proj-${result.length + 1}`, name: '', ties: next, projected: true })
    prev = next
    if (next.length === 1) break
  }

  const total = result.length
  result.forEach((r, idx) => {
    r.name = getRoundName(r.ties.length, idx === total - 1, idx === total - 2)
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
  const tiesByRound = Object.fromEntries(
    Object.entries(byRound).map(([round, matches]) => [round, buildTies(matches, playoffMatches, penScoreMap)]),
  )

  // A real knockout ladder halves in size each round (16 ties, then 8, then 4...).
  // The provider occasionally adds an extra fixture under an unrelated round id
  // (e.g. a third-place playoff) that breaks that sequence — walking the chain from
  // the biggest round and stopping at the first gap keeps only rounds that actually
  // belong to the ladder, so a stray fixture can't corrupt the bracket layout.
  const tieCountsByRound = Object.fromEntries(
    Object.entries(tiesByRound).map(([round, ties]) => [round, ties.length]),
  )
  const maxTieCount = Math.max(...Object.values(tieCountsByRound))
  const ladderTieCounts = new Set<number>()
  for (let count = maxTieCount; Object.values(tieCountsByRound).includes(count); count /= 2) {
    ladderTieCounts.add(count)
  }

  // Матч за 3-е место (например, в финале Лиги наций) тоже из одного матча, как финал,
  // и цепочка его не отсекает. В сетку идёт только финал: его играют последним (бывает, в тот же день).
  const finalRound = Object.keys(byRound)
    .filter(round => tieCountsByRound[round] === 1)
    .sort((a, b) => byRound[a]![0]!.strTimestamp.localeCompare(byRound[b]![0]!.strTimestamp))
    .at(-1)

  const sortedKeys = Object.keys(byRound)
    .filter(round => ladderTieCounts.has(tieCountsByRound[round]!))
    .filter(round => tieCountsByRound[round] !== 1 || round === finalRound)
    .sort((a, b) => tieCountsByRound[b]! - tieCountsByRound[a]!)
  const total = sortedKeys.length

  const rounds: BracketRound[] = []

  for (let index = 0; index < sortedKeys.length; index++) {
    const round = sortedKeys[index]!
    const ties = tiesByRound[round]!
    // All subsequent rounds: derive position and top/bottom order from previous round
    const ordered = rounds.length > 0 ? sortByBracketPosition(ties, rounds[rounds.length - 1]!.ties) : ties

    rounds.push({
      round,
      name: getRoundName(ordered.length, index === total - 1, index === total - 2),
      projected: false,
      ties: ordered,
    })
  }

  // Build projected rounds from the last actual round if it has multiple ties
  const lastRound = rounds[rounds.length - 1]
  if (lastRound && lastRound.ties.length > 1) {
    rounds.push(...buildProjectedRounds(lastRound))
  }

  return rounds
}
