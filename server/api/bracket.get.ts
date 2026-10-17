import type { BracketRound, BracketMatch } from '~/types'

type ApiMatch = {
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
  strSeason: string
}

type V1Response = {
  events: Array<{
    intHomeScoreExtra: string | null
    intAwayScoreExtra: string | null
  }> | null
}

// FIFA 2026 official bracket display order for Round of 32 (intRound = '32')
// Maps from timestamp-sorted index to bracket seeding position so that
// sequential pairing produces correct Round of 16 matchups.
const FIFA2026_R32_ORDER = [0, 3, 2, 5, 8, 9, 10, 11, 1, 4, 6, 7, 12, 15, 13, 14]

// For rounds after R32: sort matches by bracket position derived from prev round.
// Also detects when home/away are reversed vs bracket seeding and flags for swap.
// Even-indexed prev match winner → home (top); odd-indexed → away (bottom).
function sortByBracketPosition(
  matches: ApiMatch[],
  prevMatches: BracketMatch[],
): Array<{ match: ApiMatch, swapped: boolean }> {
  const slotCount = Math.floor(prevMatches.length / 2)
  const result: ({ match: ApiMatch, swapped: boolean } | null)[] = new Array(slotCount).fill(null)
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

export default cachedEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)
  const groupRounds = new Set(competition?.groupRounds ?? [])
  const v1Base = 'https://www.thesportsdb.com/api/v1/json'

  // Плей-офф есть только у турниров с групповым этапом или общим этапом
  if (!groupRounds.size && !competition?.leaguePhase) return { rounds: [] }

  const season = await getCurrentSeason(leagueId)
  if (!season) return { rounds: [] }

  const schedule = await getSeasonSchedule<ApiMatch>(leagueId, season)

  // Для турниров с общим этапом (ЛЧ/ЛЕ) в расписании лежат ещё и матчи
  // квалификации — оставляем только раунды плей-офф (степени двойки: 16/8/4/2/1)
  const playoffMatches = competition?.leaguePhase
    ? (() => {
        const roundCounts = getRoundCounts(schedule)
        const knockoutRounds = new Set(
          [...roundCounts.entries()]
            .filter(([, count]) => isPowerOfTwo(count))
            .map(([round]) => round),
        )
        return schedule.filter(match => knockoutRounds.has(match.intRound))
      })()
    : schedule.filter(match => !groupRounds.has(match.intRound))

  if (!playoffMatches.length) return { rounds: [] }

  // Fetch penalty scores for AP matches from v1 API
  const apMatches = playoffMatches.filter(match => match.strStatus === 'AP')
  const penScoreMap: Record<string, { home: number | null, away: number | null }> = {}
  if (apMatches.length) {
    await Promise.all(apMatches.map(async (match) => {
      const v1 = await $fetch<V1Response>(
        `${v1Base}/${config.theSportsDbApiKey}/lookupevent.php?id=${match.idEvent}`,
      ).catch(() => null)
      const eventDetails = v1?.events?.[0]
      penScoreMap[match.idEvent] = {
        home: eventDetails?.intHomeScoreExtra != null ? Number(eventDetails.intHomeScoreExtra) : null,
        away: eventDetails?.intAwayScoreExtra != null ? Number(eventDetails.intAwayScoreExtra) : null,
      }
    }))
  }

  const byRound: Record<string, ApiMatch[]> = {}
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

  // Матч за 3-е место (у Кубка Америки раунд 160) тоже из одного матча, как финал, и цепочка
  // его не отсекает. В сетку идёт только финал: его играют последним, на следующий день.
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

    type Ordered = { match: ApiMatch, swapped: boolean }
    let ordered: Ordered[]

    if (round === '32' && sorted.length === 16) {
      // R32: hardcoded FIFA 2026 seeding order (no previous round to reference)
      ordered = FIFA2026_R32_ORDER.map(i => ({ match: sorted[i]!, swapped: false }))
    }
    else if (rounds.length > 0) {
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

  return { rounds }
}, {
  maxAge: 60,
  getKey: event => `bracket-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
