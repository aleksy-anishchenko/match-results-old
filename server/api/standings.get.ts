import type { GroupStanding, StandingsResponse } from '~/types'

type ApiMatch = {
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  intRound: string
  strSeason: string
}

type ScheduleResponse = {
  schedule: ApiMatch[]
}

type TableRow = {
  strTeam: string
  strBadge: string | null
  strGroup: string | null
  strDescription: string | null
  strSeason: string | null
  intPlayed: string
  intWin: string
  intDraw: string
  intLoss: string
  intGoalsFor: string
  intGoalsAgainst: string
  intGoalDifference: string
  intPoints: string
}

type TableResponse = {
  table: TableRow[] | null
}

function calculateStandings(
  groupTeams: string[],
  badgeMap: Record<string, string>,
  finishedMatches: ApiMatch[],
): GroupStanding[] {
  const stats: Record<string, GroupStanding> = {}

  for (const team of groupTeams) {
    stats[team] = {
      team,
      badge: badgeMap[team] ?? '',
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      zone: null,
    }
  }

  for (const match of finishedMatches) {
    const {
      strHomeTeam: home,
      strAwayTeam: away,
      intHomeScore,
      intAwayScore,
    } = match
    if (!stats[home] || !stats[away]) continue

    const homeGoals = parseInt(intHomeScore ?? '0')
    const awayGoals = parseInt(intAwayScore ?? '0')

    stats[home].played++
    stats[home].goalsFor += homeGoals
    stats[home].goalsAgainst += awayGoals

    stats[away].played++
    stats[away].goalsFor += awayGoals
    stats[away].goalsAgainst += homeGoals

    if (homeGoals > awayGoals) {
      stats[home].won++
      stats[home].points += 3
      stats[away].lost++
    }
    else if (homeGoals === awayGoals) {
      stats[home].drawn++
      stats[home].points++
      stats[away].drawn++
      stats[away].points++
    }
    else {
      stats[away].won++
      stats[away].points += 3
      stats[home].lost++
    }
  }

  return Object.values(stats)
    .map(standing => ({ ...standing, goalDiff: standing.goalsFor - standing.goalsAgainst }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })
}

export default cachedEventHandler(async (event): Promise<StandingsResponse> => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)

  // Готовую таблицу (в т.ч. с группами для сборных) отдаёт lookuptable
  const tableData = await $fetch<TableResponse>(
    `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbApiKey}/lookuptable.php?l=${leagueId}`,
  ).catch(() => null)

  const rows = tableData?.table
  if (rows && rows.length) {
    const groups: Record<string, GroupStanding[]> = {}
    for (const row of rows) {
      const group = row.strGroup ? formatGroupName(row.strGroup) : 'Таблица'
      if (!groups[group]) groups[group] = []
      groups[group]!.push({
        team: row.strTeam,
        badge: row.strBadge ?? '',
        played: parseInt(row.intPlayed ?? '0'),
        won: parseInt(row.intWin ?? '0'),
        drawn: parseInt(row.intDraw ?? '0'),
        lost: parseInt(row.intLoss ?? '0'),
        goalsFor: parseInt(row.intGoalsFor ?? '0'),
        goalsAgainst: parseInt(row.intGoalsAgainst ?? '0'),
        goalDiff: parseInt(row.intGoalDifference ?? '0'),
        points: parseInt(row.intPoints ?? '0'),
        // Зоны из API только у лиг: в турнирах описания про сетку («Round of 32»),
        // а выход из группы считает страница по правилам турнира
        zone: competition?.type === 'league' ? getStandingZone(row.strDescription, leagueId) : null,
      })
    }
    return { groups: sortGroups(groups), season: rows[0]?.strSeason ?? null }
  }

  // Фолбэк: для турниров без таблицы (например, общий этап ЛЧ) считаем сами
  const headers = { 'X-API-KEY': config.theSportsDbApiKey }
  const apiBase = 'https://www.thesportsdb.com/api/v2/json'

  const nextData = await $fetch<ScheduleResponse>(
    `${apiBase}/schedule/next/league/${leagueId}`,
    { headers },
  )

  const season = nextData.schedule[0]?.strSeason
  if (!season) return { groups: {}, season: null }

  const data = await $fetch<ScheduleResponse>(
    `${apiBase}/schedule/league/${leagueId}/${season}`,
    { headers },
  )

  // Общий этап (ЛЧ/ЛЕ): определяем раунды таблицы динамически, отсекая квалификацию
  const leaguePhaseRoundCount = competition?.leaguePhase
    ? getLeaguePhaseRoundCount(getRoundCounts(data.schedule))
    : null

  let groupMatches: ApiMatch[]
  if (leaguePhaseRoundCount != null) {
    const roundCounts = getRoundCounts(data.schedule)
    const leaguePhaseRounds = new Set(
      [...roundCounts.entries()].filter(([, count]) => count === leaguePhaseRoundCount).map(([round]) => round),
    )
    groupMatches = data.schedule.filter(match => leaguePhaseRounds.has(match.intRound))
  }
  else {
    const groupRounds = new Set(competition?.groupRounds ?? [])
    groupMatches = data.schedule.filter(match => groupRounds.has(match.intRound))
  }

  if (!groupMatches.length) return { groups: {}, season }

  const badgeMap: Record<string, string> = {}
  const teams = new Set<string>()
  for (const match of groupMatches) {
    badgeMap[match.strHomeTeam] = match.strHomeTeamBadge
    badgeMap[match.strAwayTeam] = match.strAwayTeamBadge
    teams.add(match.strHomeTeam)
    teams.add(match.strAwayTeam)
  }

  const finishedMatches = groupMatches.filter(match => match.strStatus === 'FT')
  const standings = calculateStandings([...teams], badgeMap, finishedMatches)

  return { groups: { [competition?.name ?? 'Таблица']: standings }, season }
}, {
  maxAge: 60,
  getKey: event => `standings-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
